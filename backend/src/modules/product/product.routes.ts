import { Router } from 'express';
import { ProductController } from './product.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { tenantScope } from '../../common/middlewares/tenant.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import { createProductSchema, updateProductSchema, purchaseProductSchema } from './product.validation';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

// Scoped under /gyms/:gymId/products
router.post(
  '/gyms/:gymId/products',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  validate(createProductSchema, 'body'),
  ProductController.createProduct
);

router.get(
  '/gyms/:gymId/products',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.TRAINER, Role.MEMBER, Role.SUPER_ADMIN, Role.KIOSK),
  ProductController.listProducts
);

// Direct product ID endpoints
router.patch(
  '/products/:productId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  validate(updateProductSchema, 'body'),
  ProductController.updateProduct
);

router.delete(
  '/products/:productId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  ProductController.softDeleteProduct
);

router.post(
  '/products/:productId/purchase',
  authorize(Role.MEMBER, Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN, Role.KIOSK),
  validate(purchaseProductSchema, 'body'),
  ProductController.purchaseProduct
);

export default router;
