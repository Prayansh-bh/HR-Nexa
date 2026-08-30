import { Injectable, BadRequestException } from '@nestjs/common';
import { StatutoryRules } from './statutory-rules.service';

export type SalaryComponentSnapshot = {
  name: string;
  type: 'EARNING' | 'DEDUCTION';
  amount: number;
};

export interface ASTNode {
  operator: 'add' | 'subtract' | 'multiply' | 'divide' | 'min' | 'max' | 'constant' | 'variable';
  value?: number;
  name?: string;
  args?: ASTNode[];
}

@Injectable()
export class SalaryComponentCalculatorService {
  evaluateAST(node: ASTNode, variables: Record<string, number>, depth = 0): number {
    if (depth > 10) {
      throw new BadRequestException('Maximum recursion depth (10) exceeded in payroll formula.');
    }
    switch (node.operator) {
      case 'constant':
        return node.value ?? 0;
      case 'variable': {
        const varName = node.name ?? '';
        if (!(varName in variables)) {
          throw new BadRequestException(`Unknown variable reference in formula: ${varName}`);
        }
        return variables[varName];
      }
      case 'add':
        return (node.args ?? []).reduce((sum, arg) => sum + this.evaluateAST(arg, variables, depth + 1), 0);
      case 'subtract': {
        if (!node.args || node.args.length < 2) return 0;
        return this.evaluateAST(node.args[0], variables, depth + 1) - this.evaluateAST(node.args[1], variables, depth + 1);
      }
      case 'multiply': {
        if (!node.args || node.args.length < 2) return 0;
        return this.evaluateAST(node.args[0], variables, depth + 1) * this.evaluateAST(node.args[1], variables, depth + 1);
      }
      case 'divide': {
        if (!node.args || node.args.length < 2) return 0;
        const denominator = this.evaluateAST(node.args[1], variables, depth + 1);
        if (denominator === 0) {
          throw new BadRequestException('Division by zero in payroll formula.');
        }
        return this.evaluateAST(node.args[0], variables, depth + 1) / denominator;
      }
      case 'min': {
        if (!node.args || node.args.length === 0) return 0;
        return Math.min(...node.args.map(arg => this.evaluateAST(arg, variables, depth + 1)));
      }
      case 'max': {
        if (!node.args || node.args.length === 0) return 0;
        return Math.max(...node.args.map(arg => this.evaluateAST(arg, variables, depth + 1)));
      }
      default:
        throw new BadRequestException(`Unsupported formula operator: ${node.operator}`);
    }
  }

  validateFormulaGraph(components: any[]) {
    const adj = new Map<string, string[]>();
    for (const comp of components) {
      if (comp.calculationMethod === 'FORMULA' && comp.formulaJson) {
        const deps = this.getVariablesFromAST(comp.formulaJson as ASTNode);
        adj.set(comp.name, deps);
      } else {
        adj.set(comp.name, []);
      }
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycle = (node: string): boolean => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const deps = adj.get(node) || [];
      for (const dep of deps) {
        if (checkCycle(dep)) return true;
      }

      recStack.delete(node);
      return false;
    };

    for (const comp of components) {
      if (checkCycle(comp.name)) {
        throw new BadRequestException(`Circular dependency detected in payroll components around ${comp.name}`);
      }
    }
  }

  private getVariablesFromAST(node: ASTNode): string[] {
    if (!node) return [];
    if (node.operator === 'variable') {
      return node.name ? [node.name] : [];
    }
    const vars: string[] = [];
    if (node.args) {
      for (const arg of node.args) {
        vars.push(...this.getVariablesFromAST(arg));
      }
    }
    return vars;
  }

  calculateComponents(
    gross: number,
    additionalDeductions: number,
    statRules: StatutoryRules,
    salaryComponents: any[] = [],
    ptOverride?: number,
    tdsOverride?: number,
  ): { components: SalaryComponentSnapshot[]; totalDeduct: number } {
    // Basic calculation variables
    const basicSalary = Math.round(gross * (statRules.basicPercentage / 100));
    const variables: Record<string, number> = {
      Basic: basicSalary,
      BASIC: basicSalary,
      basic: basicSalary,
      Gross: gross,
      GROSS: gross,
      gross: gross,
      CTC: gross * 1.25, // Assumed multiplier for CTC conversion if needed
    };

    // First validate the components dependency graph
    this.validateFormulaGraph(salaryComponents);

    const defaultComponents = [
      { name: 'Basic Salary', type: 'EARNING', calculationMethod: 'PERCENTAGE', value: statRules.basicPercentage, calculationBase: 'GROSS' },
      { name: 'HRA', type: 'EARNING', calculationMethod: 'PERCENTAGE', value: statRules.hraPercentage, calculationBase: 'GROSS' },
      { name: 'Provident Fund', type: 'DEDUCTION', calculationMethod: 'PERCENTAGE', value: statRules.pfRate, calculationBase: 'BASIC', pfApplicable: true },
      { name: 'Professional Tax', type: 'DEDUCTION', calculationMethod: 'FIXED', value: statRules.ptAmount },
      { name: 'TDS', type: 'DEDUCTION', calculationMethod: 'PERCENTAGE', value: statRules.tdsRate, calculationBase: 'BASIC' },
    ];

    const componentsToUse = salaryComponents.length > 0 ? salaryComponents : defaultComponents;

    // Resolve component values in top-down iteration (ordered dynamically by dependencies)
    // To resolve dependency ordering, we execute simple multi-pass evaluation
    const finalComponents: SalaryComponentSnapshot[] = [];
    let totalDeduct = 0;

    const resolvedValues = { ...variables };

    // Resolve dependencies in up to 5 passes (since max recursion/depth is locked to 10)
    let passes = 0;
    const unresolved = [...componentsToUse];

    while (unresolved.length > 0 && passes < 10) {
      passes++;
      for (let i = unresolved.length - 1; i >= 0; i--) {
        const comp = unresolved[i];
        try {
          let amount = 0;
          if (comp.name === 'TDS' && typeof tdsOverride === 'number') {
            amount = tdsOverride;
          } else if (comp.calculationMethod === 'FIXED') {
            amount = Number(comp.value);
          } else if (comp.calculationMethod === 'PERCENTAGE') {
            const baseVal = resolvedValues[comp.calculationBase as string] ?? gross;
            amount = Math.round(baseVal * (Number(comp.value) / 100));
          } else if (comp.calculationMethod === 'FORMULA') {
            amount = Math.round(this.evaluateAST(comp.formulaJson as ASTNode, resolvedValues));
          }

          // Special logic for statutory ceilings
          if (comp.pfApplicable && amount > 1800) { // PF ceiling: ₹15,000 basic * 12% = ₹1,800
            amount = 1800;
          }
          if (comp.esiApplicable) {
            // ESI: 0.75% of Gross if Gross <= ₹21,000
            amount = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
          }

          resolvedValues[comp.name] = amount;
          finalComponents.push({
            name: comp.name,
            type: comp.type === 'DEDUCTION' ? 'DEDUCTION' : 'EARNING',
            amount
          });

          if (comp.type === 'DEDUCTION') {
            totalDeduct += amount;
          }

          unresolved.splice(i, 1);
        } catch (err) {
          // Dependency not resolved yet, skip to next pass
        }
      }
    }

    // Handle remaining unresolved formulas by treating them as 0
    for (const comp of unresolved) {
      finalComponents.push({
        name: comp.name,
        type: comp.type === 'DEDUCTION' ? 'DEDUCTION' : 'EARNING',
        amount: 0
      });
      if (comp.type === 'DEDUCTION') {
        totalDeduct += 0;
      }
    }

    // Handle manual ptOverride dynamically (supports explicit 0 override)
    if (ptOverride !== undefined && ptOverride >= 0) {
      const ptIndex = finalComponents.findIndex(c => c.name === 'Professional Tax');
      if (ptIndex !== -1) {
        const diff = ptOverride - finalComponents[ptIndex].amount;
        finalComponents[ptIndex].amount = ptOverride;
        totalDeduct += diff;
      }
    }

    // Incorporate additional/manual deductions entered via Payroll Inputs
    if (typeof additionalDeductions === 'number' && additionalDeductions > 0) {
      totalDeduct += additionalDeductions;
      finalComponents.push({
        name: 'Additional Deductions',
        type: 'DEDUCTION',
        amount: additionalDeductions,
      });
    }

    return { components: finalComponents, totalDeduct };
  }
}
