import { defineConfig } from 'vitest/config';
import { TEST_ENV } from './src/test/testEnv.js';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/globalSetup.ts'],
    // Nilai ini di-suntik ke process.env tiap worker SEBELUM modul test/app
    // (termasuk src/lib/env.ts) sempat dievaluasi — lihat komentar di
    // src/test/testEnv.ts kenapa nilainya dipisah dari globalSetup.
    env: TEST_ENV,
    // Semua test berbagi SATU database (datahub_test) lewat resetDb() di
    // antar test — kalau jalan paralel/multi-proses mereka saling balapan
    // truncate/insert. Paksa satu fork, tidak ada concurrency antar file.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
