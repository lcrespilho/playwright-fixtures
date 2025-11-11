---

## How to publish to npm registry

https://www.youtube.com/watch?v=Nh9xW2-ZOEU


## Using yalc for local testing

### On this package folder

```bash
npm install yalc -g # only first time per machine

yalc publish # only first time for this package
npx tsc --watch # to compile the package inside dist folder (.js files)
yalc publish --push # for every package change

# Removal
yalc installations clean @lcrespilho/playwright-fixtures
yalc remove
# also delete ~/.yalc and ./.yalc folders
```

### On local projects

```bash
yalc add @lcrespilho/playwright-fixtures # for installation

# Removal
yalc remove @lcrespilho/playwright-fixtures
# also delete ./.yalc folder
npm install @lcrespilho/playwright-fixtures # reinstall from npm registry
```

Obs: é furada. Melhor usar "npm pack" da próxima vez.
