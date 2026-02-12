# Fala Mestre - Asset Generation Tracker

**Status Legend:**
- [ ] Pending
- [/] Generating/Refining
- [x] Ready (Uploaded to `design_assets/`)

## 1. Character Assets (The Players)
**Goal:** Separable parts for Rive animation (Head, Body, Legs).
**Recommended Model:** **Recraft.ai** (Select "Vector Art" style).
*Rationale: Recraft generates native SVGs with layers, making it much easier to separate heads/limbs for rigging in Rive. Midjourney requires vectorizing explicitly.*

| Asset Name | Status | Prompts / Notes |
|:--- |:--- |:--- |
| **Base Character Body** | [ ] | **Prompt:** `A flat vector illustration of a Brazilian football player character, full body, front view. Art style similar to Duolingo or Head Soccer. Clean thick outlines, vibrant colors. The character is wearing a generic red and black striped jersey and black shorts. Cute, expressive face with a determined smile. Simple geometric aesthetics. Isolated on white background.`<br><br>*Note: Try to generate in "T-Pose" or "A-Pose" if possible for easier rigging.* |
| **Heads Variety Pack** | [ ] | **Prompt:** `A set of 5 diverse football player heads, flat vector style, thick outlines. Various hairstyles (afro, mohawk, short tint), skin tones, and expressions (happy, angry, shocked). Consistent art style with Duolingo. Isolated on white background.` |

## 2. Environment Assets (The Stadiums)
**Goal:** Static backgrounds for main menu and match screen.
**Recommended Model:** **Midjourney v6**.
*Rationale: Midjourney excels at complex lighting (sunset), composition, and "vibe". Since these are likely static backgrounds, Raster (PNG) is acceptable, though Recraft Vector is also good if you want to animate elements.*

| Asset Name | Status | Prompts / Notes |
|:--- |:--- |:--- |
| **Main Menu Stadium** | [ ] | **Prompt:** `A flat vector background illustration of a massive football stadium at sunset. Wide angle view from the pitch looking up at the stands. Crowds represented by simple colorful shapes/dots. Warm orange and purple sky. Clean simple lines, minimal detail, high contrast. "Kurzgesagt" style. Aspect ratio 9:16 (mobile vertical). --ar 9:16` |
| **Pitch (Top Down)** | [ ] | **Prompt:** `A top-down 2D vector view of a football pitch. Rich green grass with simple two-tone stripe pattern. Clean white lane markings. No players. Flat design, no perspective. Perfect for a tactical map.` |

## 3. UI Icons (The Actions)
**Goal:** Buttons and event indicators.
**Recommended Model:** **Recraft.ai**.
*Rationale: Native SVG generation ensures crisp lines at any resolution and allows for easy color manipulation in code/Rive.*

| Asset Name | Status | Prompts / Notes |
|:--- |:--- |:--- |
| **Icon Set** | [ ] | **Prompt:** `A sheet of mobile game UI icons in flat vector style: A football, a whistle, a red card, a yellow card, a medical kit, a tactic board, a golden trophy, a pile of coins. Thick rounded outlines, bright colors, catchy and readable. Isolated on white background.` |

## 4. Special FX (For Rive)
**Goal:** Deconstructed shapes for animation.
**Recommended Model:** **Recraft.ai** or **Midjourney** (w/ Vectorizer).
*Rationale: Simple shapes are easy to auto-trace if using MJ, but Recraft is safer for cleaner geometry.*

| Asset Name | Status | Prompts / Notes |
|:--- |:--- |:--- |
| **VFX Library** | [ ] | **Prompt:** `Vector assets for explosion effects: comic book style "POW" shapes, speed lines, smoke clouds, stars, and sparkles. Flat design, white and yellow colors. Deconstructed parts for animation.` |

## 📐 Design Guidelines Review
- **Style:** "Premium Flat Vector" (Duolingo / Head Soccer / Kurzgesagt)
- **Lines:** Clean, thick, consistent weight.
- **Colors:** Vibrant, no gradients (or very subtle), mobile-first contrast.
- **Format:** Prefer **SVG** for Characters/UI/FX. **PNG/JPG** ok for Backgrounds.
