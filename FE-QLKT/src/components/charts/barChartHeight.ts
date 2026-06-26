/**
 * Minimum height for a horizontal bar chart: each row needs ~44px of vertical space plus
 * a 40px margin, never below `base`. Shared so adjacent charts line up at equal heights.
 * @param rowCount - Number of rows (bars) to display
 * @param base - Minimum height, defaults to 250
 * @returns Chart height in pixels
 */
export function getHorizontalBarHeight(rowCount: number, base = 250): number {
  return Math.max(base, rowCount * 44 + 40);
}
