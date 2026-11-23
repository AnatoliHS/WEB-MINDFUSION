module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Icons that crawlers and browsers look for at the site root
  eleventyConfig.addPassthroughCopy({
    "src/assets/favicon.ico": "/favicon.ico",
    "src/assets/icon-180.png": "/apple-touch-icon.png",
  });

  eleventyConfig.addFilter("pad", (n, len = 2) => String(n).padStart(len, "0"));
  eleventyConfig.addFilter("year", () => new Date().getFullYear());
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));
  eleventyConfig.addFilter("absolute", (path, base) => new URL(path, base).href);

  eleventyConfig.setServerOptions({ watch: ["dist/assets/**/*"] });

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "html", "md"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
