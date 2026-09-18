import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { assertTenantMatch } from '../../common/middlewares/tenant.middleware';
import { ProductCategory } from './product.types';

export class ProductController {
  public static async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gymId } = req.params;
      assertTenantMatch(gymId, req);

      const product = await ProductService.createProduct(gymId, req.body);
      sendSuccess(res, product, 'Product created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gymId } = req.params;
      assertTenantMatch(gymId, req);

      const { category, isActive, branchId, page, limit } = req.query;
      const filters = {
        category: category as ProductCategory | undefined,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        branchId: (branchId as string) || (req.user?.branchId ? String(req.user.branchId) : undefined),
      };

      const result = await ProductService.listProducts(gymId, filters, {
        page: page as string,
        limit: limit as string,
      });

      sendSuccess(res, result.products, 'Products fetched successfully', 200, {
        pagination: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const gymId = req.tenant!.gymId;

      const product = await ProductService.updateProduct(productId, gymId!, req.body);
      sendSuccess(res, product, 'Product updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async softDeleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const gymId = req.tenant!.gymId;

      await ProductService.softDeleteProduct(productId, gymId!);
      sendSuccess(res, null, 'Product deleted successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async purchaseProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const actingUser = {
        id: req.user!.id,
        role: req.user!.role,
        gymId: req.tenant?.gymId,
      };

      const isStaffOrOwner = req.user!.role === 'GYM_OWNER' || req.user!.role === 'SUPER_ADMIN' || req.user!.role === 'BRANCH_MANAGER' || req.user!.role === 'KIOSK';
      const targetMemberId = (req.body.memberId && req.body.memberId !== 'walk_in')
        ? req.body.memberId
        : (isStaffOrOwner ? undefined : req.user!.id);
      const result = await ProductService.purchaseProduct(productId, targetMemberId, actingUser, req.body);

      sendSuccess(res, result, 'Product purchase completed successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}
