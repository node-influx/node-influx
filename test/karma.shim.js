const importAll = (ctx) => ctx.keys().forEach(ctx);

importAll(require.context("./unit", true, /\.test\.ts/));
