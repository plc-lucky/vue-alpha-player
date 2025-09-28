# NPM 发布检查清单

## 发布前准备

### 2. 安装依赖并构建
```bash
npm install
npm run build
```

### 3. 测试构建产物
- [ ] 检查 `dist/` 目录是否生成
- [ ] 确认包含以下文件：
  - `dist/index.js` (UMD 格式)
  - `dist/index.esm.js` (ES Module 格式)  
  - `dist/index.min.js` (压缩版本)
  - `dist/index.d.ts` (TypeScript 类型定义)

### 4. 版本管理
```bash
# 第一次发布
npm version 0.1.0

# 后续版本更新
npm version patch  # 修复bug: 1.0.0 -> 1.0.1
npm version minor  # 新功能: 1.0.0 -> 1.1.0
npm version major  # 重大更改: 1.0.0 -> 2.0.0
```

### 5. 发布到 NPM
```bash
# 登录 npm (首次)
npm login

# 发布包
npm publish

# 发布 beta 版本
npm publish --tag beta
```

## 发布后验证

### 1. 检查包是否发布成功
```bash
npm info alpha-player-webgl
```

### 2. 在新项目中测试安装
```bash
npm install alpha-player-webgl
```

### 3. 测试不同的引入方式
- ES Module: `import VueAlphaPlayerWebGL from 'alpha-player-webgl'`
- CommonJS: `const VueAlphaPlayerWebGL = require('alpha-player-webgl')`
- CDN: `<script src="https://unpkg.com/alpha-player-webgl"></script>`

## 常见问题

### 发布权限问题
确保你的 npm 账户有发布权限，新注册的账户可能需要验证邮箱。

### 版本冲突
如果版本号已存在，需要更新版本号后重新发布。

## 推荐的发布流程

1. 完成开发和测试
2. 更新 README.md 和文档
3. 运行 `npm run build` 确保构建成功
4. 运行 `npm version patch/minor/major` 更新版本
5. 运行 `npm publish` 发布到 npm
6. 创建 Git tag: `git tag v1.0.0 && git push origin v1.0.0`
7. 在 GitHub 上创建 Release
