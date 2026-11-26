# Deploying

The game is a static site, so it can be served from any static host (GDD §12). It is published as part of the
personal site:

- **Repository:** `ibusnowden/ibraniang1.github.io` (GitHub Pages, custom domain `ibra-niang.com`).
- **Pages workflow:** `.github/workflows/static.yml` uploads the whole repository on every push to `main`.
- **Game URL:** https://ibra-niang.com/needleandpin/

## Steps

```sh
npm run deploy             # typecheck + tests, build with base /needleandpin/, copy to <site>/needleandpin/, commit
npm run deploy -- --push   # same, then push: this publishes the site
```

The script uses `SITE_REPO` (default `../ibraniang1.github.io`), cloning it if needed. It replaces only the
`needleandpin/` folder and adds `.nojekyll`. Nothing else in the site is touched. To add a link from the site's home
page, edit its `index.html` by hand.

## Base path

`vite.config.ts` reads `BASE` (default `/needleandpin/`). All asset URLs, including the Web Worker and the bundled
data, are emitted relative to it. For a local preview at the root, use `BASE=/ npm run build && BASE=/ npx vite preview`.
