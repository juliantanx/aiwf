import chalk from 'chalk';
import ora, { Ora } from 'ora';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LoggerOptions {
  level?: LogLevel;
  verbose?: boolean;
}

class Logger {
  private level: LogLevel = 'info';
  private verbose: boolean = false;
  private spinner: Ora | null = null;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level === 'debug' || this.verbose) {
      console.log(chalk.gray('[debug]'), message, ...args);
    }
  }

  info(message: string): void {
    if (this.level !== 'silent') {
      this.stopSpinner();
      console.log(chalk.blue('ℹ'), message);
    }
  }

  success(message: string): void {
    if (this.level !== 'silent') {
      this.stopSpinner();
      console.log(chalk.green('✓'), message);
    }
  }

  warn(message: string): void {
    if (this.level !== 'silent') {
      this.stopSpinner();
      console.log(chalk.yellow('⚠'), message);
    }
  }

  error(message: string, error?: Error): void {
    if (this.level !== 'silent') {
      this.stopSpinner();
      console.error(chalk.red('✗'), message);
      if (error && this.verbose) {
        console.error(chalk.gray(error.stack ?? error.message));
      }
    }
  }

  startSpinner(message: string): void {
    this.stopSpinner();
    this.spinner = ora(message).start();
  }

  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  stopSpinner(success: boolean = true, message?: string): void {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(message);
      } else {
        this.spinner.fail(message);
      }
      this.spinner = null;
    }
  }

  table(data: Record<string, unknown>[]): void {
    if (this.level !== 'silent') {
      console.table(data);
    }
  }

  newline(): void {
    if (this.level !== 'silent') {
      console.log();
    }
  }

  raw(message: string): void {
    if (this.level !== 'silent') {
      console.log(message);
    }
  }
}

export const logger = new Logger();
