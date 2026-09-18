import { Router } from 'express';
import { ExpenseController } from './expense.controller';
import { authenticate } from '../../common/middlewares/auth.middleware';
import { authorize } from '../../common/middlewares/authorize.middleware';
import { tenantScope } from '../../common/middlewares/tenant.middleware';
import { validate } from '../../common/middlewares/validate.middleware';
import { Role } from '../../common/constants/roles.enum';
import { createExpenseSchema, updateExpenseSchema } from './expense.validation';

const router = Router();

router.use(authenticate);
router.use(tenantScope);

// Scoped under /gyms/:gymId/expenses
router.post(
  '/gyms/:gymId/expenses',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(createExpenseSchema, 'body'),
  ExpenseController.recordExpense
);

router.get(
  '/gyms/:gymId/expenses',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  ExpenseController.listExpenses
);

// Profit summary dashboard endpoint
router.get(
  '/gyms/:gymId/dashboard/profit-summary',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  ExpenseController.getProfitSummary
);

// Direct expense ID endpoints
router.patch(
  '/expenses/:expenseId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  validate(updateExpenseSchema, 'body'),
  ExpenseController.updateExpense
);

router.delete(
  '/expenses/:expenseId',
  authorize(Role.GYM_OWNER, Role.BRANCH_MANAGER, Role.SUPER_ADMIN),
  ExpenseController.deleteExpense
);

export default router;
