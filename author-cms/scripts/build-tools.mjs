import { build } from "esbuild";
for (const name of ["manage", "transfer"])
  await build({
    entryPoints: [`scripts/${name}.mts`],
    outfile: `.tools/${name}.mjs`,
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    external: ["pg", "sharp"],
    banner: {
      js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
    },
  });
