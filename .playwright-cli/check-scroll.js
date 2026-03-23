async (page) => {
  const result = await page.evaluate(() => {
    const panel = document.querySelector('[aria-label="Map layers"]');
    if (!panel) return "panel not found";
    const scrollEl = panel.querySelector(".overflow-y-auto");
    if (!scrollEl) return "no scroll el found";
    const before = scrollEl.scrollTop;
    scrollEl.scrollTop = scrollEl.scrollHeight;
    return JSON.stringify({
      scrollHeight: scrollEl.scrollHeight,
      clientHeight: scrollEl.clientHeight,
      scrolledFrom: before,
      scrolledTo: scrollEl.scrollTop,
      canScroll: scrollEl.scrollHeight > scrollEl.clientHeight,
      panelHeight: panel.getBoundingClientRect().height,
      panelOverflow: getComputedStyle(panel).overflow,
    });
  });
  console.log(result);
};
