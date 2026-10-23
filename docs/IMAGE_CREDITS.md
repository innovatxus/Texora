# Image credits

All storefront photography is the store's own, supplied by the store owner. The generic stock photos used during development have been removed.

## Campaign photography

Source files are in `public/media/assets/campaign`. `npx tsx scripts/campaign-images.ts` builds every slot into `public/media/stock`, using the crops in `scripts/stock-catalog.ts`: 900×1200 category tiles, and hero banners at 2400×1200 (desktop) and 1200×1500 (phone), each with a calm area for the headline.

| Slot          | Source                                             | Description                                                                                                     |
| ------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| heroWomen     | `public/media/assets/campaign/olive-trench.jpg`    | A woman in an olive trench coat and cream trousers carrying gift boxes through a limestone courtyard            |
| heroMen       | `public/media/assets/campaign/menswear-motion.jpg` | Three men walking across a sunlit concrete plaza in an olive jacket, a cream knit polo and a charcoal overshirt |
| heroSale      | `public/media/assets/campaign/evening-villa.jpg`   | Three people in evening wear, an olive satin gown, a dark suit and a black draped dress, in a sunlit villa      |
| womenDresses  | `public/media/assets/campaign/champagne-dress.jpg` | A woman in a champagne pleated midi dress with an olive handbag                                                 |
| womenTops     | `public/media/assets/campaign/denim-pair.jpg`      | A woman in a fitted ivory tee and high-waisted jeans                                                            |
| womenSweaters | `public/media/assets/campaign/oatmeal-knit.jpg`    | A woman in an oatmeal cable-knit cardigan and olive ribbed skirt                                                |
| womenPants    | `public/media/assets/campaign/olive-trench.jpg`    | Wide cream trousers under an olive trench coat                                                                  |
| womenJeans    | `public/media/assets/campaign/denim-pair.jpg`      | Wide-leg mid-wash jeans with brown loafers                                                                      |
| womenCoats    | `public/media/assets/campaign/olive-trench.jpg`    | A woman in a belted olive trench coat                                                                           |
| menShirts     | `public/media/assets/campaign/denim-pair.jpg`      | A man in a charcoal overshirt over an olive tee                                                                 |
| menTees       | `public/media/assets/campaign/denim-pair.jpg`      | An olive crew-neck tee under an open charcoal overshirt                                                         |
| menSweaters   | `public/media/assets/campaign/olive-overcoat.jpg`  | A man in a charcoal crew-neck sweater under an olive overcoat                                                   |
| menPants      | `public/media/assets/campaign/olive-overcoat.jpg`  | Pressed black trousers with Chelsea boots                                                                       |
| menJeans      | `public/media/assets/campaign/denim-pair.jpg`      | Straight dark-wash jeans with brown leather boots                                                               |
| menCoats      | `public/media/assets/campaign/olive-overcoat.jpg`  | A man in a long olive wool overcoat                                                                             |

## Home hero

| Slot      | Source                                                                    | Description                                                                   |
| --------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Home hero | `public/media/assets/texora hero.png`, framed by `scripts/hero-images.ts` | Three people walking in relaxed neutral tailoring, wide trousers and sneakers |
