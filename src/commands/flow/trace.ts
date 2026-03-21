import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';

interface DataFlowStep {
  step: number;
  location: string;
  action: string;
  detail: string;
}

export class FlowTraceCommand extends Command {
  public getDescription(): string {
    return 'Trace data flow';
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt flow-trace <symbol> [path]',
      description: 'Trace data flow for a variable/symbol through code',
      examples: [
        'adt flow-trace userId src/',
        'adt flow-trace requestData src/services',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    const options = this.parseArgs(args);
    this.setFormat(options.fmt);

    return this.runWithLogging('flow trace', args, async () => {
      if (!options.symbol) {
        throw createError('ENOENT', 'Symbol name is required');
      }

      const targetPath = options.path || process.cwd();

      if (!fs.existsSync(targetPath)) {
        throw createError('ENOENT', targetPath);
      }

      const flow = await this.traceDataFlow(options.symbol, targetPath);

      if (this.formatManager.getFormat() === 'slim') {
        return this.formatSlim(options.symbol, flow);
      }

      return this.formatNormal(options.symbol, flow);
    });
  }

  private async traceDataFlow(symbol: string, targetPath: string): Promise<DataFlowStep[]> {
    const steps: DataFlowStep[] = [];
    const tsFiles = FileUtils.findFiles(targetPath, '**/*.ts');

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Simple pattern matching for data flow
        if (line.includes(symbol)) {
          const trimmed = line.trim();

          if (trimmed.includes(`${symbol} =`) || trimmed.includes(`${symbol}=`)) {
            steps.push({
              step: steps.length + 1,
              location: `${file}:${i + 1}`,
              action: 'ASSIGN',
              detail: trimmed,
            });
          } else if (trimmed.includes(`return ${symbol}`)) {
            steps.push({
              step: steps.length + 1,
              location: `${file}:${i + 1}`,
              action: 'RETURN',
              detail: trimmed,
            });
          } else if (trimmed.match(new RegExp(`\\w+\\(${symbol}`))) {
            steps.push({
              step: steps.length + 1,
              location: `${file}:${i + 1}`,
              action: 'PASS',
              detail: trimmed,
            });
          }
        }
      }
    }

    return steps;
  }

  private formatSlim(symbol: string, flow: DataFlowStep[]): CommandResult {
    const lines = flow.map(step =>
      `:${step.step}  ${step.location}  ${step.action}  ${step.detail.substring(0, 50)}`
    );

    const output = [
      `${symbol}:`,
      ...lines,
      '---',
      `${flow.length} trace steps  ~${this.estimateTokens(lines.join('\n'))} tokens`
    ].join('\n');

    return {
      ok: true,
      command: 'flow',
      action: 'trace',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      symbol,
      flow,
    };
  }

  private formatNormal(symbol: string, flow: DataFlowStep[]): CommandResult {
    const sections: string[] = [
      `ok: true`,
      `symbol: ${symbol}`,
      `trace-depth: ${flow.length}`,
      `===`
    ];

    for (const step of flow) {
      sections.push(`STEP ${step.step}: ${step.action}`);
      sections.push(`  location: ${step.location}`);
      sections.push(`  detail: ${step.detail}`);
      sections.push('');
    }

    const output = sections.join('\n');

    return {
      ok: true,
      command: 'flow',
      action: 'trace',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      symbol,
      flow,
    };
  }

  private parseArgs(args: string[]): { symbol?: string; path?: string; fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--path' && nextArg) {
        options.path = nextArg;
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (!arg.startsWith('--')) {
        options.symbol = arg;
      }
    }

    return options;
  }
}
