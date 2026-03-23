import { createConsola } from 'consola';

export interface Ui {
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  printJson(value: unknown): void;
}

export function createUi(jsonMode: boolean): Ui {
  const logger = createConsola({
    formatOptions: process.env.NO_COLOR ? { colors: false } : {},
  });

  return {
    info(message) {
      if (!jsonMode) {
        logger.info(message);
      }
    },
    success(message) {
      if (!jsonMode) {
        logger.success(message);
      }
    },
    warn(message) {
      if (!jsonMode) {
        logger.warn(message);
      }
    },
    error(message) {
      if (!jsonMode) {
        logger.error(message);
      }
    },
    printJson(value) {
      process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    },
  };
}
