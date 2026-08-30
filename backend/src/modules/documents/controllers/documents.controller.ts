import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { UploadDocumentDto } from '../dto/upload-document.dto';
import { GenerateEmployeeOfferDto } from '../dto/generate-employee-offer.dto';
import { PreviewEmployeeOfferDto } from '../dto/preview-employee-offer.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { join } from 'path';
import * as fs from 'fs';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { DocumentsService } from '../services/documents.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { RequirePermissions } from '../../auth/permissions.decorator';
import { Permission } from '../../auth/permissions.enum';
import { Roles } from '../../auth/roles.decorator';
import { Role } from '../../auth/role.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { TenantContext } from '../../../common/tenant/tenant-context.util';
import { RejectDocumentDto } from '../dto/reject-document.dto';
import { VerifyDocumentDto } from '../dto/verify-document.dto';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Post('upload')
  @RequirePermissions(Permission.EMPLOYEES_PROFILE_DOCS_UPLOAD)
  @ApiOperation({ summary: 'Upload a physical document' })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiBadRequestResponse({ description: 'Invalid upload metadata or file' })
  @ApiForbiddenResponse({ description: 'Forbidden: Insufficient privileges' })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: any,
    @Body() dto: any,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    const scope = TenantContext.getRequiredTenantScope(user);

    const category = dto.category || 'EMPLOYEE';
    const employeeId = dto.employeeId || null;

    if ((user.role as Role) === Role.Employee && employeeId && user.employee?.id !== employeeId) {
      throw new ForbiddenException('You can only upload documents for yourself');
    }

    if (category === 'COMPLIANCE' && (user.role as Role) === Role.Employee) {
      throw new ForbiddenException('Employees cannot upload compliance documents');
    }

    return this.service.uploadFile(file, {
      companyId: scope.companyId,
      employeeId,
      title: dto.title || file?.originalname,
      category,
      docType: dto.docType || 'Document',
      fileName: file?.originalname || dto.fileName,
      size: file ? `${(file.size / 1024).toFixed(1)} KB` : dto.size,
      status: dto.status || 'VALID',
      verificationStatus: 'PENDING',
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
    });
  }

  @Post('preview-employee-offer')
  @RequirePermissions(Permission.EMPLOYEES_PROFILE_DOCS_UPLOAD)
  @ApiOperation({ summary: 'Preview compensation breakdown for an active Employee offer letter' })
  async previewEmployeeOffer(
    @Request() req: AuthenticatedRequest,
    @Body() dto: PreviewEmployeeOfferDto,
  ) {
    if ((req.user.role as Role) === Role.Employee) {
      throw new ForbiddenException('Employees cannot generate or preview offer letters');
    }
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.service.previewEmployeeOffer(scope, dto);
  }

  @Post('generate-employee-offer')
  @RequirePermissions(Permission.EMPLOYEES_PROFILE_DOCS_UPLOAD)
  @ApiOperation({ summary: 'Generate an official Offer Letter for an active Employee' })
  async generateEmployeeOffer(
    @Request() req: AuthenticatedRequest,
    @Body() dto: GenerateEmployeeOfferDto,
  ) {
    if ((req.user.role as Role) === Role.Employee) {
      throw new ForbiddenException('Employees cannot generate or preview offer letters');
    }
    const scope = TenantContext.getRequiredTenantScope(req.user);
    return this.service.generateEmployeeOffer(scope, dto);
  }

  @Get('download/:id')
  @RequirePermissions(Permission.EMPLOYEES_PROFILE_DOCS_DOWNLOAD)
  @ApiOperation({ summary: 'Download a physical document' })
  @ApiResponse({ status: 200, description: 'File binary or structured fallback summary streamed' })
  @ApiNotFoundResponse({ description: 'Document record not found' })
  @ApiForbiddenResponse({ description: 'Forbidden: Cross-tenant or unauthorized access' })
  async download(@Param('id') id: string, @Res() res: Response, @Request() req: AuthenticatedRequest) {
    const user = req.user;
    const scope = TenantContext.getRequiredTenantScope(user);

    const doc = await this.service.findOne(id, scope);

    if ((user.role as Role) === Role.Employee) {
      if (doc.employeeId) {
        if (user.employee?.id !== doc.employeeId) {
          throw new ForbiddenException('You can only access your own documents');
        }
      } else if (doc.category !== 'COMPLIANCE') {
        throw new ForbiddenException('You are not authorized to access this document');
      }
    }

    const { doc: documentRecord, streamOrBuffer } = await this.service.download(id, scope);

    // If file exists on local filesystem path, stream directly via res.download
    const localFullPath = documentRecord.filePath ? join(process.cwd(), documentRecord.filePath) : '';
    if (localFullPath && fs.existsSync(localFullPath)) {
      return res.download(localFullPath, documentRecord.fileName);
    }

    // Otherwise stream streamOrBuffer to client
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(documentRecord.fileName)}"`);
    if (typeof (streamOrBuffer as any).pipe === 'function') {
      (streamOrBuffer as any).pipe(res);
    } else {
      res.end(streamOrBuffer);
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get document records' })
  @ApiQuery({ name: 'employeeId', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, enum: ['EMPLOYEE', 'HR_LETTER', 'COMPLIANCE', 'OTHER', 'TAX_DECLARATION', 'EXPENSE_RECEIPT'] })
  @ApiQuery({ name: 'verificationStatus', required: false, enum: ['PENDING', 'VERIFIED', 'REJECTED'] })
  @ApiQuery({ name: 'docType', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['VALID', 'EXPIRING', 'EXPIRED'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of documents retrieved' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized JWT token' })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('employeeId') employeeId?: string,
    @Query('category') category?: string,
    @Query('verificationStatus') verificationStatus?: string,
    @Query('docType') docType?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string | number,
    @Query('limit') limit?: string | number,
  ) {
    const user = req.user;
    const scope = TenantContext.getRequiredTenantScope(user);
    const parsedPage = page ? parseInt(String(page), 10) : undefined;
    const parsedLimit = limit ? parseInt(String(limit), 10) : undefined;

    // Validate enum values to avoid fail-open invalid inputs
    const validCategories = ['EMPLOYEE', 'HR_LETTER', 'COMPLIANCE', 'OTHER', 'TAX_DECLARATION', 'EXPENSE_RECEIPT'];
    const validVerificationStatuses = ['PENDING', 'VERIFIED', 'REJECTED'];
    const validStatuses = ['VALID', 'EXPIRING', 'EXPIRED'];

    const safeCategory = category && validCategories.includes(category) ? category : undefined;
    const safeVerificationStatus = verificationStatus && validVerificationStatuses.includes(verificationStatus) ? verificationStatus : undefined;
    const safeStatus = status && validStatuses.includes(status) ? status : undefined;
    const safeDocType = docType && docType.trim() ? docType.trim() : undefined;
    const safeSearch = search && search.trim() ? search.trim() : undefined;

    if ((user.role as Role) === Role.Employee) {
      return this.service.findAll(
        scope,
        safeCategory,
        safeCategory === 'COMPLIANCE' ? undefined : user.employee?.id,
        safeVerificationStatus,
        safeSearch,
        parsedPage,
        parsedLimit,
        safeDocType,
        safeStatus,
      );
    }

    return this.service.findAll(
      scope,
      safeCategory,
      employeeId,
      safeVerificationStatus,
      safeSearch,
      parsedPage,
      parsedLimit,
      safeDocType,
      safeStatus,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific document record details' })
  @ApiResponse({ status: 200, description: 'Document record details' })
  @ApiNotFoundResponse({ description: 'Document not found' })
  async findOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const user = req.user;
    const scope = TenantContext.getRequiredTenantScope(user);

    const doc = await this.service.findOne(id, scope);
    if (
      (user.role as Role) === Role.Employee &&
      user.employee?.id !== doc.employeeId
    ) {
      throw new ForbiddenException('You can only access your own documents');
    }
    return doc;
  }

  @Patch(':id/verify')
  @RequirePermissions(Permission.DOCUMENTS_VERIFY)
  @ApiOperation({ summary: 'Verify an employee identity document' })
  @ApiResponse({ status: 200, description: 'Document verified successfully' })
  @ApiForbiddenResponse({ description: 'Forbidden: Restricted to authorized document verifiers' })
  @ApiNotFoundResponse({ description: 'Document not found' })
  @ApiConflictResponse({ description: 'Conflict: Document is no longer pending verification' })
  async verify(
    @Param('id') id: string,
    @Body() dto: VerifyDocumentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    const scope = TenantContext.getRequiredTenantScope(user);
    return this.service.verifyDocument(id, dto?.note, scope, {
      id: user.id,
      role: user.role,
      employee: user.employee || undefined,
    });
  }

  @Patch(':id/reject')
  @RequirePermissions(Permission.DOCUMENTS_VERIFY)
  @ApiOperation({ summary: 'Reject an employee identity document with reason' })
  @ApiResponse({ status: 200, description: 'Document rejected successfully' })
  @ApiBadRequestResponse({ description: 'Bad Request: Rejection reason must be at least 5 characters' })
  @ApiForbiddenResponse({ description: 'Forbidden: Restricted to authorized document verifiers' })
  @ApiNotFoundResponse({ description: 'Document not found' })
  @ApiConflictResponse({ description: 'Conflict: Document is no longer pending verification' })
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectDocumentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    const scope = TenantContext.getRequiredTenantScope(user);
    return this.service.rejectDocument(id, dto.reason, scope, {
      id: user.id,
      role: user.role,
      employee: user.employee || undefined,
    });
  }

  @Delete(':id')
  @RequirePermissions(Permission.EMPLOYEES_PROFILE_DOCS_DELETE)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const user = req.user;
    const scope = TenantContext.getRequiredTenantScope(user);
    return this.service.remove(id, scope);
  }
}
