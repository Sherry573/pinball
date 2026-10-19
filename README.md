# 霓虹弹珠台 · NEON PINBALL

一个纯前端、零依赖的 2D 弹珠台游戏。单个 `index.html` 文件包含全部 HTML / CSS / JavaScript，不引用任何外部库、CDN、图片或音频资源。

## 在线试玩

部署到 GitHub Pages 后，链接形如：

```
https://<你的用户名>.github.io/<仓库名>/
```

## 本地运行

直接双击 `index.html` 即可（也可用任意静态服务器打开）。页面全部资源内联，`file://` 下也能正常运行。

## 操作

| 操作 | 桌面 | 移动端 |
| --- | --- | --- |
| 蓄力 / 发射 | 按住 `空格`（或点击画布）蓄力，松开发射 | 按住「发射」按钮，松开发射 |
| 左挡板 | `←` / `A` | 左下「左挡板」按钮 |
| 右挡板 | `→` / `D` | 右下「右挡板」按钮 |
| 暂停 / 继续 | `P` / `Esc` | 右上「暂停」按钮 |
| 重新开始 | `R` | 右上「重开」按钮 |

## 玩法与计分

- 共 3 颗球，球掉入底部掉球区即扣 1 颗；球用完游戏结束
- 圆形缓冲器 **+100**（命中会明显弹开并脉冲放大）
- 小钉子 **+10**
- 两盏目标灯全部点亮 **+500**，随后自动重置
- 最高分保存在浏览器 `localStorage`
- 连续命中会显示 COMBO 提示

## 技术实现

- 逻辑分辨率 480×800，Canvas 按容器等比缩放并适配 devicePixelRatio
- `requestAnimationFrame` 主循环 + 固定物理步长 1/120s，每步 3 个子步防止穿透
- 碰撞：圆-线段（平面法线推出）、圆-圆、圆-顶部圆弧、圆-挡板胶囊
- 挡板旋转时把接触点线速度（`ω × r`）合入反弹计算，形成真实弹射
- 音效由 WebAudio 实时合成，首次用户交互后初始化
- 所有可调参数（重力、反弹系数、挡板速度、发射力度等）集中在 `CONFIG` 对象中

## 部署到 GitHub Pages

```bash
# 1. 在 GitHub 新建一个空仓库（不要勾选 README），然后：
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

2. 进入仓库 → **Settings** → **Pages** → Source 选择 **Deploy from a branch** → Branch 选 `main` / `(root)` → Save
3. 等待约 1 分钟，访问 `https://<用户名>.github.io/<仓库名>/`

> 若想要 `https://<用户名>.github.io/` 这样的根域名地址，把仓库命名为 `<用户名>.github.io` 即可。
