import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DevicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.biometricDevice.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.biometricDevice.findUnique({
      where: { id },
    });
  }

  async create(data: {
    name: string;
    ip: string;
    status?: string;
    last?: string;
  }) {
    return this.prisma.biometricDevice.create({
      data: {
        name: data.name,
        ip: data.ip,
        status: data.status || 'Online',
        last: data.last || 'Just now',
      },
    });
  }

  async update(
    id: string,
    data: { name?: string; ip?: string; status?: string; last?: string },
  ) {
    return this.prisma.biometricDevice.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.biometricDevice.delete({
      where: { id },
    });
  }
}
