import esbuild from "esbuild";
await esbuild.build({entryPoints:["src/fixture-entry.tsx"],bundle:true,outfile:"fixture/fixture.js",format:"iife",platform:"browser",jsx:"automatic",loader:{".tsx":"tsx",".ts":"ts",".css":"css"},alias:{"react-router-dom":"./src/vendor/react-router-dom.tsx"},define:{"process.env.NODE_ENV":"\"production\""},minify:false,sourcemap:false});
