import { Request, Response, NextFunction } from 'express';
import { ExpenseService } from './expense.service';
import { sendSuccess } from '../../common/utils/ApiResponse';
import { assertTenantMatch } from '../../common/middlewares/tenant.middleware';
import { ExpenseCategory } from './expense.types';

export class ExpenseController {
  public static async recordExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gymId } = req.params;
      assertTenantMatch(gymId, req);

      const userId = req.user!.id;
      const expense = await ExpenseService.recordExpense(gymId, userId, req.body);
      sendSuccess(res, expense, 'Expense recorded successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async listExpenses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gymId } = req.params;
      assertTenantMatch(gymId, req);

      const { branchId, category, startDate, endDate, page, limit } = req.query;
      const filters = {
        branchId: branchId as string | undefined,
        category: category as ExpenseCategory | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };

      const result = await ExpenseService.listExpenses(gymId, filters, {
        page: page as string,
        limit: limit as string,
      });

      sendSuccess(res, result.expenses, 'Expenses fetched successfully', 200, {
        pagination: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async updateExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { expenseId } = req.params;
      const gymId = req.tenant!.gymId;

      const expense = await ExpenseService.updateExpense(expenseId, gymId!, req.body);
      sendSuccess(res, expense, 'Expense updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async deleteExpense(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { expenseId } = req.params;
      const gymId = req.tenant!.gymId;

      await ExpenseService.deleteExpense(expenseId, gymId!);
      sendSuccess(res, null, 'Expense deleted successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getProfitSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gymId } = req.params;
      assertTenantMatch(gymId, req);

      const { startDate, endDate } = req.query;
      const dateRange = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };

      const profitSummary = await ExpenseService.getProfitSummary(gymId, dateRange);
      sendSuccess(res, profitSummary, 'Profit summary generated successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}
