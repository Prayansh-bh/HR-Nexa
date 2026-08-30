import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class SubscriptionCouponService {
  constructor(private readonly prisma: PrismaService) {}

  async listCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCoupon(data: {
    code: string;
    discountPercent: number;
    expiryDate: string;
    maxUses?: number;
  }) {
    const existing = await this.prisma.coupon.findUnique({
      where: { code: data.code.toUpperCase() },
    });
    if (existing) {
      throw new BadRequestException(
        `Coupon with code "${data.code}" already exists.`,
      );
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    return this.prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        discountType: 'percent',
        discountValue: data.discountPercent,
        validFrom: todayStr,
        validUntil: data.expiryDate,
        maxUses: data.maxUses || 100,
        usedCount: 0,
        active: true,
      },
    });
  }

  async applyCoupon(subscriptionId: string, code: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!coupon) {
      throw new NotFoundException(`Coupon with code "${code}" not found.`);
    }

    if (!coupon.active) {
      throw new BadRequestException(`Coupon "${code}" is no longer active.`);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (coupon.validUntil < todayStr) {
      throw new BadRequestException(`Coupon "${code}" has expired.`);
    }

    if (coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException(
        `Coupon "${code}" has reached its maximum redemptions.`,
      );
    }

    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub) {
      throw new NotFoundException(
        `Subscription with ID "${subscriptionId}" not found.`,
      );
    }

    const discountFactor = (100 - coupon.discountValue) / 100;
    const newAmount = Math.round(sub.amount * discountFactor);

    await this.prisma.coupon.update({
      where: { id: coupon.id },
      data: { usedCount: coupon.usedCount + 1 },
    });

    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        amount: newAmount,
      },
    });
  }
}
