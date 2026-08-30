import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReviewCycleRepository } from '../repositories/review-cycle.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PERFORMANCE_EVENTS } from '../../../common/events/performance.events';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReviewCycleDto } from '../dto/create-review-cycle.dto';

@Injectable()
export class ReviewCycleService {
  constructor(
    private readonly repository: ReviewCycleRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    companyId: string,
    companyName: string,
    data: CreateReviewCycleDto,
    userId: string,
  ) {
    const startTime = new Date(data.startDate).getTime();
    const endTime = new Date(data.endDate).getTime();
    const deadlineTime = new Date(data.deadline).getTime();

    if (isNaN(startTime) || isNaN(endTime) || isNaN(deadlineTime)) {
      throw new BadRequestException(
        'Invalid date format: startDate, endDate, and deadline must be valid ISO date strings.',
      );
    }

    if (startTime >= endTime) {
      throw new BadRequestException(
        'Cycle startDate must be strictly before endDate.',
      );
    }

    if (deadlineTime < endTime) {
      throw new BadRequestException(
        'Cycle deadline cannot be earlier than endDate.',
      );
    }

    const scope = data.participantScope;

    if (scope === 'SELECTED') {
      const rawIds = data.participantIds || [];
      const sanitizedIds = Array.from(
        new Set(
          rawIds
            .map((id) => (typeof id === 'string' ? id.trim() : ''))
            .filter(Boolean),
        ),
      );

      if (sanitizedIds.length === 0) {
        throw new BadRequestException(
          'At least one participant must be selected when participantScope is SELECTED.',
        );
      }
    }

    const cycle = await this.prisma.$transaction(async (tx) => {
      // 1. Fetch eligible employees for this company (Status: Active or On Leave)
      const eligibleEmployees = await tx.employee.findMany({
        where: {
          companyId: companyId,
          status: { in: ['Active', 'On Leave'] },
        },
        include: { user: true },
      });

      // 2. Exclude HR Admin users per existing business rule
      const eligibleParticipants = eligibleEmployees.filter(
        (emp) => !(emp.user && emp.user.role === 'HR Admin'),
      );

      const eligibleIdSet = new Set(eligibleParticipants.map((emp) => emp.id));
      let participantIdsToEnroll: string[] = [];

      if (scope === 'SELECTED') {
        const rawIds = data.participantIds || [];
        const requestedIds = Array.from(
          new Set(
            rawIds
              .map((id) => (typeof id === 'string' ? id.trim() : ''))
              .filter(Boolean),
          ),
        );

        if (requestedIds.length === 0) {
          throw new BadRequestException(
            'At least one participant must be selected when participantScope is SELECTED.',
          );
        }

        const invalidOrIneligibleIds = requestedIds.filter(
          (id) => !eligibleIdSet.has(id),
        );

        if (invalidOrIneligibleIds.length > 0) {
          throw new BadRequestException(
            `Invalid or ineligible participant(s) selected: ${invalidOrIneligibleIds.length} employee(s) not found, inactive, or not eligible in this company.`,
          );
        }

        participantIdsToEnroll = requestedIds;
      } else {
        // scope === 'ALL'
        participantIdsToEnroll = eligibleParticipants.map((emp) => emp.id);
      }

      // 3. Create the review cycle record
      const createdCycle = await this.repository.create(
        companyId,
        companyName,
        {
          name: data.name,
          description: data.description || '',
          reviewType: data.reviewType || 'Quarterly',
          startDate: data.startDate,
          endDate: data.endDate,
          deadline: data.deadline,
          status: data.status || 'Draft',
          createdBy: userId,
          updatedBy: userId,
        },
        tx as any,
      );

      // 4. Create participant rows
      if (participantIdsToEnroll.length > 0) {
        const participantsToCreate = participantIdsToEnroll.map((empId) => ({
          reviewCycleId: createdCycle.id,
          employeeId: empId,
          status: 'Pending',
        }));

        // @ts-ignore: TS cache issue with new Prisma schema
        await tx.reviewCycleParticipant.createMany({
          data: participantsToCreate,
          skipDuplicates: true,
        });
      }

      return createdCycle;
    });

    this.eventEmitter.emit(PERFORMANCE_EVENTS.CYCLE_CREATED, {
      cycleId: cycle.id,
      name: cycle.name,
      companyId,
    });

    return cycle;
  }

  async findAll(
    companyId?: string | null,
    status?: string,
    options?: { page?: number; limit?: number },
  ) {
    return this.repository.findMany(companyId, status, options);
  }

  async findById(id: string, companyId?: string | null) {
    const cycle = await this.repository.findById(id, companyId);
    if (!cycle) {
      throw new NotFoundException(`Review cycle with ID ${id} not found`);
    }
    return cycle;
  }

  async update(id: string, companyId: string | null, data: any, userId: string) {
    const cycle = await this.repository.findById(id, companyId);
    if (!cycle) {
      throw new NotFoundException(`Review cycle with ID ${id} not found`);
    }

    const updated = await this.repository.update(id, companyId, {
      name: data.name !== undefined ? data.name : cycle.name,
      description:
        data.description !== undefined ? data.description : cycle.description,
      reviewType:
        data.reviewType !== undefined ? data.reviewType : cycle.reviewType,
      startDate:
        data.startDate !== undefined ? data.startDate : cycle.startDate,
      endDate: data.endDate !== undefined ? data.endDate : cycle.endDate,
      deadline: data.deadline !== undefined ? data.deadline : cycle.deadline,
      status: data.status !== undefined ? data.status : cycle.status,
      updatedBy: userId,
    });

    // Note: To fully support participant update on an existing Draft cycle, we would clear and recreate the snapshot.
    // For now, snapshot is created at creation time.

    this.eventEmitter.emit(PERFORMANCE_EVENTS.CYCLE_UPDATED, {
      cycleId: updated.id,
      name: updated.name,
      status: updated.status,
      companyId,
    });

    return updated;
  }

  async delete(id: string, companyId?: string | null) {
    const cycle = await this.repository.findById(id, companyId);
    if (!cycle) {
      throw new NotFoundException(`Review cycle with ID ${id} not found`);
    }

    const deleted = await this.repository.delete(id, companyId);

    this.eventEmitter.emit(PERFORMANCE_EVENTS.CYCLE_DELETED, {
      cycleId: id,
      name: deleted.name,
      companyId,
    });

    return deleted;
  }
}
