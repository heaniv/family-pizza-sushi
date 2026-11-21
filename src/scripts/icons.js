// Inline vectors keep artwork independent of emoji fonts and operating systems.
const paths = {
  pizza:
    '<path d="m4 3 16 6-12 12L4 3Z M5 7l12 5"/><circle cx="9" cy="10" r="1"/><circle cx="10" cy="15" r="1"/>',
  sushi:
    '<ellipse cx="12" cy="7" rx="8" ry="4"/><path d="M4 7v10c0 5 16 5 16 0V7"/><ellipse cx="12" cy="7" rx="3" ry="1.5"/>',
  hot: '<path d="M3 12h18a9 9 0 0 1-18 0ZM8 4c-3 3 3 3 0 6m5-7c-3 3 3 3 0 6m5-5c-3 3 3 3 0 6M7 22h10"/>',
  salads:
    '<path d="M3 13h18a9 9 0 0 1-18 0ZM12 13C4 12 3 8 6 4c5 0 8 3 6 9Zm0-1c0-6 3-8 8-8 1 4-1 7-8 8Z"/>',
  sides:
    '<path d="m5 10 2 11h10l2-11H5ZM7 10 6 4l4-1 1 7m1 0 1-8 4 1-1 7m2 0 1-5 3 1-1 4"/>',
  desserts:
    '<path d="M4 11h16v10H4ZM4 11l9-7 7 7M4 16c3-3 5 3 8 0s5 3 8 0M13 4V2"/>',
  star: '<path d="M12 2v20M2 12h20M5 5l14 14M5 19 19 5"/>',
  arrow: '<path d="M5 19 19 5M5 5h14v14"/>',
  right: '<path d="M3 12h18m-8-8 8 8-8 8"/>',
  downright: '<path d="m5 5 14 14M5 19h14V5"/>',
  takeaway: '<path d="m4 6 2 14h12l2-14H4Zm4 0V3h8v3"/>',
  down: '<path d="M12 4v16m-7-7 7 7 7-7"/>',
  up: '<path d="M12 20V4m-7 7 7-7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bag: '<path d="M5 8h14l1 13H4L5 8Zm3 0V6a4 4 0 0 1 8 0v2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  delivery:
    '<path d="M2 5h12v13H2ZM14 9h4l4 5v4h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
};
export function icon(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] || paths.star}</svg>`;
}
