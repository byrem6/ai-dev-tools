import { Command } from '../../core/command';
import { CommandResult, OutputFormat } from '../../types';
import { FileUtils } from '../../utils/file';
import { createError } from '../../core/error';
import * as fs from 'fs';
import * as path from 'path';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in-progress' | 'done';
  steps: TaskStep[];
  createdAt: string;
  updatedAt: string;
}

interface TaskStep {
  number: number;
  description: string;
  status: 'pending' | 'done';
  completedAt?: string;
}

interface TaskData {
  tasks: Record<string, Task>;
  lastId: number;
}

export class TaskCommand extends Command {
  public getDescription(): string {
    return 'Manage development tasks';
  }
  private tasksFile: string;

  constructor(
    formatManager: any,
    configManager: any,
    sessionManager: any
  ) {
    super(formatManager, configManager, sessionManager);
    this.tasksFile = path.join(process.cwd(), '.adt-tasks.json');
  }

  public showHelp(): CommandResult {
    return super.showHelp({
      usage: 'adt task <action> [options]',
      description: 'Task management - create, list, and track project tasks',
      examples: [
        'adt task create "Refactor payment module"',
        'adt task list --status open',
        'adt task step add T1 "1. Create interface"',
        'adt task status',
      ],
    });
  }

  async execute(...args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return this.status(args);
    }

    const action = args[0];
    const actionArgs = args.slice(1);

    switch (action) {
      case 'create':
        return this.create(actionArgs);
      case 'list':
        return this.list(actionArgs);
      case 'status':
        return this.status(actionArgs);
      case 'step':
        return this.step(actionArgs);
      case 'done':
        return this.done(actionArgs);
      default:
        throw createError('ENOENT', `Unknown task action: ${action}`);
    }
  }

  private async create(args: string[]): Promise<CommandResult> {
    const options = this.parseCreateArgs(args);

    if (!options.title) {
      throw createError('ENOENT', 'Title is required');
    }

    const data = this.loadTasks();
    const taskId = `T${data.lastId + 1}`;

    const task: Task = {
      id: taskId,
      title: options.title,
      description: options.description,
      status: 'open',
      steps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.tasks[taskId] = task;
    data.lastId++;

    this.saveTasks(data);

    if (this.formatManager.getFormat() === 'slim') {
      const output = `ok true  ${taskId}  "${options.title}"  created`;
      return {
        ok: true,
        command: 'task',
        action: 'create',
        tokenEstimate: this.estimateTokens(output),
        content: output,
        taskId,
      };
    }

    const output = `ok: true
task: ${taskId}  "${options.title}"  created
---
status: ${task.status}
created: ${this.formatDate(task.createdAt)}`;

    return {
      ok: true,
      command: 'task',
      action: 'create',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      taskId,
    };
  }

  private async list(args: string[]): Promise<CommandResult> {
    const options = this.parseListArgs(args);
    const data = this.loadTasks();

    let tasks = Object.values(data.tasks);

    if (options.status && options.status !== 'all') {
      tasks = tasks.filter(t => t.status === options.status);
    }

    tasks = tasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    if (this.formatManager.getFormat() === 'slim') {
      const lines = tasks.map(t => {
        const statusChar = t.status === 'done' ? '✓' : t.status === 'in-progress' ? '→' : '○';
        const stepsInfo = `${t.steps.filter(s => s.status === 'done').length}/${t.steps.length} steps`;
        return `${statusChar}  ${t.id}  ${t.title}  [${stepsInfo}]`;
      });

      const output = [...lines, `---`, `${tasks.length} tasks`].join('\n');

      return {
        ok: true,
        command: 'task',
        action: 'list',
        tokenEstimate: this.estimateTokens(output),
        content: output,
        count: tasks.length,
      };
    }

    const sections: string[] = [`ok: true`, `tasks: ${tasks.length}`, `===`];

    for (const task of tasks) {
      const completedSteps = task.steps.filter(s => s.status === 'done').length;
      sections.push(`${task.id}  ${task.title}  [${task.status}]`);
      sections.push(`  progress: ${completedSteps}/${task.steps.length} steps`);
      sections.push(`  created: ${this.formatDate(task.createdAt)}`);
    }

    const output = sections.join('\n');

    return {
      ok: true,
      command: 'task',
      action: 'list',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      count: tasks.length,
    };
  }

  private async status(args: string[]): Promise<CommandResult> {
    const data = this.loadTasks();
    const inProgressTasks = Object.values(data.tasks).filter(t => t.status === 'in-progress');

    if (inProgressTasks.length === 0) {
      const output = 'ok true  No active task. Use "adt task create <title>" to create one.';

      return {
        ok: true,
        command: 'task',
        action: 'status',
        tokenEstimate: this.estimateTokens(output),
        content: output,
        activeTask: null,
      };
    }

    const activeTask = inProgressTasks[0];

    if (this.formatManager.getFormat() === 'slim') {
      const lines = [
        `${activeTask.id}  ${activeTask.title}  [${activeTask.steps.filter(s => s.status === 'done').length}/${activeTask.steps.length} steps]`,
      ];

      for (const step of activeTask.steps) {
        const status = step.status === 'done' ? '✓' : '○';
        lines.push(`  ${status}  ${step.number}. ${step.description}`);
      }

      const output = lines.join('\n');

      return {
        ok: true,
        command: 'task',
        action: 'status',
        tokenEstimate: this.estimateTokens(output),
        content: output,
        activeTask,
      };
    }

    const sections: string[] = [
      `ok: true`,
      `task: ${activeTask.id}  ${activeTask.title}`,
      `progress: ${activeTask.steps.filter(s => s.status === 'done').length}/${activeTask.steps.length} steps`,
      `created: ${this.formatDate(activeTask.createdAt)}`,
      `===`
    ];

    for (const step of activeTask.steps) {
      const status = step.status === 'done' ? '✓' : '○';
      sections.push(`${status}  step ${step.number}: ${step.description}`);
    }

    const output = sections.join('\n');

    return {
      ok: true,
      command: 'task',
      action: 'status',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      activeTask,
    };
  }

  private async step(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      throw createError('ENOENT', 'Step action required: add|done');
    }

    const stepAction = args[0];
    const stepArgs = args.slice(1);

    switch (stepAction) {
      case 'add':
        return this.stepAdd(stepArgs);
      case 'done':
        return this.stepDone(stepArgs);
      default:
        throw createError('ENOENT', `Unknown step action: ${stepAction}`);
    }
  }

  private async stepAdd(args: string[]): Promise<CommandResult> {
    const options = this.parseStepAddArgs(args);

    if (!options.taskId) {
      throw createError('ENOENT', 'Task ID is required');
    }

    if (!options.description) {
      throw createError('ENOENT', 'Step description is required');
    }

    const data = this.loadTasks();
    const task = data.tasks[options.taskId];

    if (!task) {
      throw createError('ENOENT', `Task not found: ${options.taskId}`);
    }

    const stepNumber = task.steps.length + 1;
    const step: TaskStep = {
      number: stepNumber,
      description: options.description,
      status: 'pending',
    };

    task.steps.push(step);
    task.updatedAt = new Date().toISOString();

    if (task.status === 'open') {
      task.status = 'in-progress';
    }

    this.saveTasks(data);

    const output = `ok true  ${options.taskId}  step ${stepNumber} added: "${options.description}"`;

    return {
      ok: true,
      command: 'task',
      action: 'step-add',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      taskId: options.taskId,
      stepNumber,
    };
  }

  private async stepDone(args: string[]): Promise<CommandResult> {
    const options = this.parseStepDoneArgs(args);

    if (!options.taskId) {
      throw createError('ENOENT', 'Task ID is required');
    }

    if (!options.stepNumber) {
      throw createError('ENOENT', 'Step number is required');
    }

    const data = this.loadTasks();
    const task = data.tasks[options.taskId];

    if (!task) {
      throw createError('ENOENT', `Task not found: ${options.taskId}`);
    }

    const step = task.steps.find(s => s.number === options.stepNumber);

    if (!step) {
      throw createError('ENOENT', `Step not found: ${options.stepNumber}`);
    }

    step.status = 'done';
    step.completedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();

    const allDone = task.steps.every(s => s.status === 'done');
    if (allDone) {
      task.status = 'done';
    }

    this.saveTasks(data);

    const output = `ok true  ${options.taskId}  step ${options.stepNumber} marked as done`;

    return {
      ok: true,
      command: 'task',
      action: 'step-done',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      taskId: options.taskId,
      stepNumber: options.stepNumber,
    };
  }

  private async done(args: string[]): Promise<CommandResult> {
    const options = this.parseDoneArgs(args);

    if (!options.taskId) {
      throw createError('ENOENT', 'Task ID is required');
    }

    const data = this.loadTasks();
    const task = data.tasks[options.taskId];

    if (!task) {
      throw createError('ENOENT', `Task not found: ${options.taskId}`);
    }

    task.status = 'done';
    task.updatedAt = new Date().toISOString();

    this.saveTasks(data);

    const output = `ok true  ${options.taskId}  marked as done`;

    return {
      ok: true,
      command: 'task',
      action: 'done',
      tokenEstimate: this.estimateTokens(output),
      content: output,
      taskId: options.taskId,
    };
  }

  private loadTasks(): TaskData {
    if (!fs.existsSync(this.tasksFile)) {
      return { tasks: {}, lastId: 0 };
    }

    try {
      const content = fs.readFileSync(this.tasksFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return { tasks: {}, lastId: 0 };
    }
  }

  private saveTasks(data: TaskData): void {
    fs.writeFileSync(this.tasksFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  private formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toISOString().split('T')[0].split('-').reverse().join('/');
  }

  private parseCreateArgs(args: string[]): { title?: string; description?: string; fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--desc' && nextArg) {
        options.description = nextArg;
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (!arg.startsWith('--')) {
        options.title = arg;
      }
    }

    return options;
  }

  private parseListArgs(args: string[]): { status?: string; fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--status' && nextArg) {
        options.status = nextArg;
        i++;
      } else if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      }
    }

    return options;
  }

  private parseStepAddArgs(args: string[]): { taskId?: string; description?: string; fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (!arg.startsWith('--') && !options.taskId) {
        options.taskId = arg;
      } else if (!arg.startsWith('--') && options.taskId && !options.description) {
        options.description = arg;
      }
    }

    return options;
  }

  private parseStepDoneArgs(args: string[]): { taskId?: string; stepNumber?: number; fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (!arg.startsWith('--') && !options.taskId) {
        options.taskId = arg;
      } else if (!arg.startsWith('--') && options.taskId && !options.stepNumber) {
        options.stepNumber = parseInt(arg, 10);
      }
    }

    return options;
  }

  private parseDoneArgs(args: string[]): { taskId?: string; fmt?: OutputFormat } {
    const options: any = {};

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      if (arg === '--fmt' && nextArg) {
        options.fmt = nextArg as OutputFormat;
        i++;
      } else if (!arg.startsWith('--')) {
        options.taskId = arg;
      }
    }

    return options;
  }
}
