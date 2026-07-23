import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of requiring an authenticated actor before DbTransactionInterceptor opens its transaction. Use only for routes that never touch RLS-protected tables. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
