// Lets plain `node` run the repo's extension-less TypeScript imports in tests.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (e) {
    if (e.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !/\.\w+$/.test(specifier)) {
      return next(specifier + ".ts", context);
    }
    throw e;
  }
}
