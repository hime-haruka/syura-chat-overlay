
(() => {
  const clientId = location.pathname.split('/').filter(Boolean).pop() || 'pop';
  const debug = new URLSearchParams(location.search).get('debug') === '1';
  const FIELD = window.SE_FIELD_DATA || {};
  let socket;
  let seq = 0;

  const DECOR = {"default": "", "subscriber": "<svg class=\"frogsub\" width=\"363.773\" height=\"344.541\" viewBox=\"0 0 96.248 91.16\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path style=\"fill:var(--frog1);fill-opacity:1;stroke-width:.148082;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:0;paint-order:markers fill stroke\" d=\"M134.747 107.075a12.604 12.604 0 0 0-12.604 12.604 12.604 12.604 0 0 0 2.17 7.07 48.05 49.305 0 0 0-13.782 34.516 48.05 49.305 0 0 0 .125 3.434c.67 5.995 4.596 24.353 27.728 29.674 27.766 6.387 52.96-3.992 52.96-3.992s13.627-8.551 15.191-26.491a48.05 49.305 0 0 0 .096-2.625 48.05 49.305 0 0 0-13.615-34.344 12.737 12.737 0 0 0 2.06-6.931 12.737 12.737 0 0 0-12.736-12.737 12.737 12.737 0 0 0-11.093 6.486 48.05 49.305 0 0 0-12.666-1.779 48.05 49.305 0 0 0-12.71 1.791 12.604 12.604 0 0 0-11.124-6.676z\" transform=\"translate(-110.457 -107)\"/>\n  <path style=\"fill:var(--frog2);fill-opacity:1;stroke-width:.14764;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:0;paint-order:markers fill stroke\" d=\"M191.907 172.01a12.578 12.986 0 0 0-12.578 12.986 12.578 12.986 0 0 0 12.578 12.985 12.578 12.986 0 0 0 12.578-12.985 12.578 12.986 0 0 0-12.578-12.986zm-66.885.105a12.578 12.986 0 0 0-12.578 12.986 12.578 12.986 0 0 0 12.578 12.986A12.578 12.986 0 0 0 137.6 185.1a12.578 12.986 0 0 0-12.578-12.986z\" transform=\"translate(-110.457 -107)\"/>\n  <path style=\"fill:#423e4f;fill-opacity:1;stroke-width:.158378;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:0;paint-order:markers fill stroke\" d=\"M134.698 116.756a1.938 1.938 0 0 0-1.942 1.942v4.579c0 1.076.866 1.942 1.942 1.942h.099a1.938 1.938 0 0 0 1.942-1.942v-4.579a1.938 1.938 0 0 0-1.942-1.942zm47.592.067a1.938 1.938 0 0 0-1.942 1.942v4.579c0 1.076.866 1.942 1.942 1.942h.1a1.938 1.938 0 0 0 1.942-1.942v-4.579a1.938 1.938 0 0 0-1.943-1.942zm-30.013 4.28a2.025 2.025 0 0 0-1.459.525 2.025 2.025 0 0 0-.132 2.862s1.746 1.951 4.597 2.928c2.852.976 7.06.788 10.997-2.793a2.025 2.025 0 0 0 .134-2.862 2.025 2.025 0 0 0-2.86-.135c-3.026 2.755-5.186 2.565-6.96 1.958-1.775-.608-2.914-1.823-2.914-1.823a2.025 2.025 0 0 0-1.403-.66z\" transform=\"translate(-110.457 -107)\"/>\n</svg>\n<svg class=\"lilysub\" width=\"215.453\" height=\"88.193\" viewBox=\"0 0 57.005 23.334\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path style=\"fill:var(--frog1);fill-opacity:1;stroke:none;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M129.3 110.263a11.667 11.667 0 0 0-11.667 11.666 11.667 11.667 0 0 0 11.668 11.668 11.667 11.667 0 0 0 11.195-8.405l-4.214-2.773 4.634-1.571a11.667 11.667 0 0 0-11.615-10.585zm33.723 0a11.667 11.667 0 0 0-11.668 11.666 11.667 11.667 0 0 0 11.668 11.668 11.667 11.667 0 0 0 11.195-8.405l-4.214-2.773 4.634-1.571a11.667 11.667 0 0 0-11.615-10.585z\" transform=\"translate(-117.633 -110.263)\"/>\n</svg>", "plainBorder": "", "streamer": "<div class=\"righthand\">\n<svg width=\"23.985\" height=\"43\" viewBox=\"0 0 6.346 11.377\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <rect style=\"fill:var(--frog1);fill-opacity:1;stroke:none;stroke-width:4.60725;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke\" width=\"43.025\" height=\"17.343\" x=\"130.817\" y=\"113.388\" ry=\"8.672\" transform=\"matrix(-.1157 .0292 .0293 .1156 16.565 -10.131)\"/>\n</svg>\n</div>\n<div class=\"lefthand\">\n<svg class=\"lefthandflower\" width=\"114.746\" height=\"112.375\" viewBox=\"0 0 30.36 29.733\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <g transform=\"translate(-85.547 -84.92)\">\n    <path style=\"fill:var(--lily1);fill-opacity:1;stroke:none;stroke-width:5.75495;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke\" d=\"M100.664 84.92a7.84 7.84 0 0 0-7.38 5.21 7.84 7.84 0 0 0-7.737 7.838 7.84 7.84 0 0 0 3.069 6.216 7.84 7.84 0 0 0-.372 2.377 7.84 7.84 0 0 0 7.841 7.841 7.84 7.84 0 0 0 4.409-1.357 7.84 7.84 0 0 0 4.75 1.608 7.84 7.84 0 0 0 7.84-7.84 7.84 7.84 0 0 0-.362-2.355 7.84 7.84 0 0 0 3.185-6.302 7.84 7.84 0 0 0-7.794-7.84 7.84 7.84 0 0 0-7.449-5.395z\"/>\n    <circle style=\"fill:var(--lily1);filter:brightness(1.6);fill-opacity:1;stroke:none;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke\" cx=\"100.852\" cy=\"100.728\" r=\"5.771\"/>\n  </g>\n</svg>\n<svg class=\"lefthandw\" width=\"19.725\" height=\"31.618\" viewBox=\"0 0 5.219 8.365\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <g transform=\"translate(-11.346 -13.166) scale(.1193)\">\n    <path style=\"color:#000;fill:#b0ebce;fill-opacity:.964706;stroke-linecap:round;stroke-linejoin:round;-inkscape-stroke:none;paint-order:markers fill stroke\" d=\"M100.676 110.355a2.325 2.325 0 0 0-2.205 2.442s1.056 20.92 2.675 33.879c.725 5.794-.685 13.573-2.355 19.777-1.67 6.204-3.525 10.826-3.525 10.826a2.325 2.325 0 0 0 1.289 3.024 2.325 2.325 0 0 0 3.025-1.29s1.956-4.87 3.701-11.35c1.745-6.482 3.353-14.583 2.48-21.563-1.573-12.59-2.646-33.54-2.646-33.54a2.325 2.325 0 0 0-2.44-2.205z\"/>\n    <rect style=\"fill:var(--frog1);fill-opacity:1;stroke:none;stroke-width:4.60725;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke\" width=\"43.025\" height=\"17.343\" x=\"130.817\" y=\"113.388\" ry=\"8.672\" transform=\"rotate(14.168) skewX(-.05)\"/>\n    <path style=\"color:#000;fill:#60d9a7;fill-opacity:1;stroke-linecap:round;stroke-linejoin:round;-inkscape-stroke:none;paint-order:markers fill stroke\" d=\"M100.676 110.356a2.325 2.325 0 0 0-2.206 2.44s.263 5.202.727 12.02h4.666c-.473-6.91-.748-12.255-.748-12.255a2.325 2.325 0 0 0-2.439-2.205z\"/>\n  </g>\n</svg>\n\n</div>\n<svg class=\"frogsub\" width=\"363.773\" height=\"344.541\" viewBox=\"0 0 96.248 91.16\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path style=\"fill:var(--frog1);fill-opacity:1;stroke-width:.148082;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:0;paint-order:markers fill stroke\" d=\"M134.747 107.075a12.604 12.604 0 0 0-12.604 12.604 12.604 12.604 0 0 0 2.17 7.07 48.05 49.305 0 0 0-13.782 34.516 48.05 49.305 0 0 0 .125 3.434c.67 5.995 4.596 24.353 27.728 29.674 27.766 6.387 52.96-3.992 52.96-3.992s13.627-8.551 15.191-26.491a48.05 49.305 0 0 0 .096-2.625 48.05 49.305 0 0 0-13.615-34.344 12.737 12.737 0 0 0 2.06-6.931 12.737 12.737 0 0 0-12.736-12.737 12.737 12.737 0 0 0-11.093 6.486 48.05 49.305 0 0 0-12.666-1.779 48.05 49.305 0 0 0-12.71 1.791 12.604 12.604 0 0 0-11.124-6.676z\" transform=\"translate(-110.457 -107)\"/>\n  <path style=\"fill:var(--frog2);fill-opacity:1;stroke-width:.14764;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:0;paint-order:markers fill stroke\" d=\"M191.907 172.01a12.578 12.986 0 0 0-12.578 12.986 12.578 12.986 0 0 0 12.578 12.985 12.578 12.986 0 0 0 12.578-12.985 12.578 12.986 0 0 0-12.578-12.986zm-66.885.105a12.578 12.986 0 0 0-12.578 12.986 12.578 12.986 0 0 0 12.578 12.986A12.578 12.986 0 0 0 137.6 185.1a12.578 12.986 0 0 0-12.578-12.986z\" transform=\"translate(-110.457 -107)\"/>\n  <path style=\"fill:#423e4f;fill-opacity:1;stroke-width:.158378;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:0;paint-order:markers fill stroke\" d=\"M134.698 116.756a1.938 1.938 0 0 0-1.942 1.942v4.579c0 1.076.866 1.942 1.942 1.942h.099a1.938 1.938 0 0 0 1.942-1.942v-4.579a1.938 1.938 0 0 0-1.942-1.942zm47.592.067a1.938 1.938 0 0 0-1.942 1.942v4.579c0 1.076.866 1.942 1.942 1.942h.1a1.938 1.938 0 0 0 1.942-1.942v-4.579a1.938 1.938 0 0 0-1.943-1.942zm-30.013 4.28a2.025 2.025 0 0 0-1.459.525 2.025 2.025 0 0 0-.132 2.862s1.746 1.951 4.597 2.928c2.852.976 7.06.788 10.997-2.793a2.025 2.025 0 0 0 .134-2.862 2.025 2.025 0 0 0-2.86-.135c-3.026 2.755-5.186 2.565-6.96 1.958-1.775-.608-2.914-1.823-2.914-1.823a2.025 2.025 0 0 0-1.403-.66z\" transform=\"translate(-110.457 -107)\"/>\n</svg>\n<svg class=\"lilyfrog\" width=\"148.174\" height=\"76.104\" viewBox=\"0 0 39.204 20.136\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path style=\"fill:var(--lilypad);fill-opacity:1;stroke:none;stroke-width:4.76365;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M144.48 110.933A19.602 10.068 0 0 0 124.877 121a19.602 10.068 0 0 0 19.603 10.067 19.602 10.068 0 0 0 7.62-.792c.212-.206.287-.598-.062-1.34-.862-1.835-1.05-2.29-1.05-2.29s-.048-.533.485-.423c.534.11 5.52 1.49 5.52 1.49s1.215.382 2.2-.063a19.602 10.068 0 0 0 4.888-6.65 19.602 10.068 0 0 0-19.601-10.067z\" transform=\"translate(-124.877 -110.933)\"/>\n</svg>\n<svg class=\"lilymod\" width=\"193.587\" height=\"82.314\" viewBox=\"0 0 51.22 21.779\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <g style=\"fill:var(--frog1);fill-opacity:1\">\n    <path style=\"fill:var(--frog1);fill-opacity:1;stroke:none;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M129.3 110.263c-6.443 0-11.667 5.223-11.667 11.666 0 6.444 5.224 11.668 11.668 11.668a11.668 11.668 0 0 0 11.195-8.405l-4.214-2.773 4.634-1.571a11.667 11.667 0 0 0-11.615-10.585z\" transform=\"rotate(-97.633 20.761 110.59) scale(.93569)\"/>\n  </g>\n  <g style=\"fill:var(--frog1);fill-opacity:1\">\n    <path style=\"fill:var(--frog1);fill-opacity:1;stroke:none;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M129.3 110.263c-6.443 0-11.667 5.223-11.667 11.666 0 6.444 5.224 11.668 11.668 11.668a11.668 11.668 0 0 0 11.195-8.405l-4.214-2.773 4.634-1.571a11.667 11.667 0 0 0-11.615-10.585z\" transform=\"rotate(-97.633 35.485 97.77) scale(.93569)\"/>\n  </g>\n</svg>\n<svg class=\"lilymain\" width=\"249.943\" height=\"188.08\" viewBox=\"0 0 66.131 49.763\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path style=\"fill:var(--lilypad); filter:brightness(1.4) hue-rotate(-10deg) saturate(90%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"m1.146 30.765 13.972 6.428s1.147.59.098 1.017c-1.05.426-14.76 6.888-14.76 6.888s-.82.656-.262 1.18c.558.525 3.936 3.28 7.38 3.28s29.453-.033 29.453-.033 1.344.164 2.427-2.099c1.082-2.263 1.213-2.722 1.41-2.853.197-.131.558-.984 1.148.164.59 1.148 1.837 3.739 1.837 3.739s.262 1.082 2 1.05c1.739-.033 9.676-.033 9.676-.033s5.87-.328 8.92-5.609c3.051-5.28.952-10.364.952-10.364s-2.493-5.543-6.756-6.757c0 0-9.046-3.957-17.163-3.632-8.117.325-17.115 2.922-17.115 2.922l-17.58.093s-4.685.881-6.262 3.061c0 0-.835.902.625 1.558z\"/>\n  <ellipse style=\"fill:var(--lilypad);fill-opacity:1;stroke-width:4.70067;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" cx=\"41.467\" cy=\"30.982\" rx=\"15.912\" ry=\"7.807\"/>\n  <path style=\"fill:var(--lilypad);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M65.96 35.796a12.22 12.22 0 0 1-1.605 5.076c-3.05 5.28-8.921 5.608-8.921 5.608s-7.937 0-9.676.033c-1.738.033-2-1.05-2-1.05s-1.247-2.59-1.837-3.738c-.59-1.148-.951-.295-1.148-.164-.197.131-.328.59-1.41 2.853-1.082 2.263-2.427 2.1-2.427 2.1s-26.009.032-29.453.032c-2.179 0-4.329-1.102-5.758-2.045l-1.268.597s-.82.656-.263 1.18c.558.525 3.936 3.28 7.38 3.28s29.453-.033 29.453-.033 1.345.164 2.427-2.099c1.082-2.263 1.213-2.722 1.41-2.853.197-.131.557-.984 1.148.164.59 1.148 1.836 3.739 1.836 3.739s.263 1.082 2.001 1.05c1.739-.034 9.676-.033 9.676-.033s5.87-.328 8.92-5.609c1.788-3.094 1.805-6.112 1.515-8.088z\"/>\n  <path style=\"fill:var(--lily1);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.57 30.599s-4.916 3.757-14.656-1.67-10.298-12.384-10.298-12.384 5.335-2.737 13.22 1.206C37.72 21.693 41.57 30.599 41.57 30.599z\"/>\n  <path style=\"fill:var(--lily1); filter:brightness(0.95) saturate(110%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.177 30.637s4.916 3.757 14.657-1.67c9.74-5.427 10.297-12.385 10.297-12.385s-5.334-2.736-13.22 1.206c-7.885 3.943-11.734 12.849-11.734 12.849zM21.676 15.621c-3.179-.041-5.06.924-5.06.924s.557 6.957 10.298 12.384c6.001 3.344 10.168 3.2 12.486 2.598-2.293-.095-5.277-.786-8.962-2.754-9.835-5.253-10.515-12.2-10.515-12.2s1.122-.599 3.108-.875a16.04 16.04 0 0 0-1.355-.077z\"/>\n  <path style=\"fill:var(--lily1);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M61.072 15.659c-.435.006-.895.03-1.378.08-.762 2.475-2.29 5.512-5.262 8.782-6.17 6.788-11.225 6.644-12.825 6.379 1.386.75 6.143 2.57 14.227-1.933 9.74-5.427 10.297-12.385 10.297-12.385s-1.88-.964-5.059-.923z\"/>\n  <path style=\"fill:var(--lily2);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.478 30.83s-6.865-.649-12.71-9.925C22.926 11.628 25.94 3.928 25.94 3.928s7.42 1.206 11.039 7.932c3.618 6.725 4.499 18.97 4.499 18.97z\"/>\n  <path style=\"fill:var(--lily2); filter:brightness(0.95) saturate(110%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M25.94 3.928s-3.016 7.7 2.829 16.977c5.844 9.276 12.709 9.926 12.709 9.926s-.03-.402-.096-1.078c-2.532-1.183-5.974-3.566-9.21-8.357-5.53-8.185-3.836-15.3-3.445-16.634-1.626-.643-2.788-.834-2.788-.834Z\"/>\n  <path style=\"fill:var(--lily2); filter:brightness(0.95) saturate(110%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.344 30.83s6.865-.649 12.71-9.925c5.844-9.277 2.829-16.977 2.829-16.977s-7.422 1.206-11.04 7.932c-3.617 6.725-4.499 18.97-4.499 18.97z\"/>\n  <path style=\"fill:var(--lily2);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M56.79 3.975s-3.213.522-6.441 2.795c.493.888 3.946 7.659.069 17.104-.452 1.1-.933 2.1-1.43 3.012 1.622-1.42 3.337-3.34 4.973-5.935 5.844-9.277 2.829-16.976 2.829-16.976z\"/>\n  <path style=\"fill:var(--lily3);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.29 0s-8.134 4.592-7.478 16.006c.656 11.413 7.61 14.824 7.61 14.824s7.871-4.854 7.74-16.005C49.03 3.674 41.29 0 41.29 0Z\"/>\n  <path style=\"fill:var(--lily3); filter:brightness(0.95) saturate(110%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.29 0s-8.134 4.592-7.478 16.006c.656 11.413 7.61 14.825 7.61 14.825s.686-.426 1.648-1.307c-2.015-1.612-5.636-5.59-6.096-13.585-.48-8.373 3.878-12.99 6.082-14.773C42.031.352 41.29 0 41.29 0Z\"/>\n</svg>", "manager": "<div class=\"righthand\">\n<svg width=\"23.985\" height=\"43\" viewBox=\"0 0 6.346 11.377\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <rect style=\"fill:var(--frog1);fill-opacity:1;stroke:none;stroke-width:4.60725;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke\" width=\"43.025\" height=\"17.343\" x=\"130.817\" y=\"113.388\" ry=\"8.672\" transform=\"matrix(-.1157 .0292 .0293 .1156 16.565 -10.131)\"/>\n</svg>\n</div>\n<div class=\"lefthand\">\n<svg class=\"lefthandflower\" width=\"114.746\" height=\"112.375\" viewBox=\"0 0 30.36 29.733\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <g transform=\"translate(-85.547 -84.92)\">\n    <path style=\"fill:var(--lily1);fill-opacity:1;stroke:none;stroke-width:5.75495;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke\" d=\"M100.664 84.92a7.84 7.84 0 0 0-7.38 5.21 7.84 7.84 0 0 0-7.737 7.838 7.84 7.84 0 0 0 3.069 6.216 7.84 7.84 0 0 0-.372 2.377 7.84 7.84 0 0 0 7.841 7.841 7.84 7.84 0 0 0 4.409-1.357 7.84 7.84 0 0 0 4.75 1.608 7.84 7.84 0 0 0 7.84-7.84 7.84 7.84 0 0 0-.362-2.355 7.84 7.84 0 0 0 3.185-6.302 7.84 7.84 0 0 0-7.794-7.84 7.84 7.84 0 0 0-7.449-5.395z\"/>\n    <circle style=\"fill:var(--lily1);filter:brightness(1.6);fill-opacity:1;stroke:none;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke\" cx=\"100.852\" cy=\"100.728\" r=\"5.771\"/>\n  </g>\n</svg>\n<svg class=\"lefthandw\" width=\"19.725\" height=\"31.618\" viewBox=\"0 0 5.219 8.365\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <g transform=\"translate(-11.346 -13.166) scale(.1193)\">\n    <path style=\"color:#000;fill:#b0ebce;fill-opacity:.964706;stroke-linecap:round;stroke-linejoin:round;-inkscape-stroke:none;paint-order:markers fill stroke\" d=\"M100.676 110.355a2.325 2.325 0 0 0-2.205 2.442s1.056 20.92 2.675 33.879c.725 5.794-.685 13.573-2.355 19.777-1.67 6.204-3.525 10.826-3.525 10.826a2.325 2.325 0 0 0 1.289 3.024 2.325 2.325 0 0 0 3.025-1.29s1.956-4.87 3.701-11.35c1.745-6.482 3.353-14.583 2.48-21.563-1.573-12.59-2.646-33.54-2.646-33.54a2.325 2.325 0 0 0-2.44-2.205z\"/>\n    <rect style=\"fill:var(--frog1);fill-opacity:1;stroke:none;stroke-width:4.60725;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke\" width=\"43.025\" height=\"17.343\" x=\"130.817\" y=\"113.388\" ry=\"8.672\" transform=\"rotate(14.168) skewX(-.05)\"/>\n    <path style=\"color:#000;fill:#60d9a7;fill-opacity:1;stroke-linecap:round;stroke-linejoin:round;-inkscape-stroke:none;paint-order:markers fill stroke\" d=\"M100.676 110.356a2.325 2.325 0 0 0-2.206 2.44s.263 5.202.727 12.02h4.666c-.473-6.91-.748-12.255-.748-12.255a2.325 2.325 0 0 0-2.439-2.205z\"/>\n  </g>\n</svg>\n\n</div>\n<svg class=\"frogsub\" width=\"363.773\" height=\"344.541\" viewBox=\"0 0 96.248 91.16\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path style=\"fill:var(--frog1);fill-opacity:1;stroke-width:.148082;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:0;paint-order:markers fill stroke\" d=\"M134.747 107.075a12.604 12.604 0 0 0-12.604 12.604 12.604 12.604 0 0 0 2.17 7.07 48.05 49.305 0 0 0-13.782 34.516 48.05 49.305 0 0 0 .125 3.434c.67 5.995 4.596 24.353 27.728 29.674 27.766 6.387 52.96-3.992 52.96-3.992s13.627-8.551 15.191-26.491a48.05 49.305 0 0 0 .096-2.625 48.05 49.305 0 0 0-13.615-34.344 12.737 12.737 0 0 0 2.06-6.931 12.737 12.737 0 0 0-12.736-12.737 12.737 12.737 0 0 0-11.093 6.486 48.05 49.305 0 0 0-12.666-1.779 48.05 49.305 0 0 0-12.71 1.791 12.604 12.604 0 0 0-11.124-6.676z\" transform=\"translate(-110.457 -107)\"/>\n  <path style=\"fill:var(--frog2);fill-opacity:1;stroke-width:.14764;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:0;paint-order:markers fill stroke\" d=\"M191.907 172.01a12.578 12.986 0 0 0-12.578 12.986 12.578 12.986 0 0 0 12.578 12.985 12.578 12.986 0 0 0 12.578-12.985 12.578 12.986 0 0 0-12.578-12.986zm-66.885.105a12.578 12.986 0 0 0-12.578 12.986 12.578 12.986 0 0 0 12.578 12.986A12.578 12.986 0 0 0 137.6 185.1a12.578 12.986 0 0 0-12.578-12.986z\" transform=\"translate(-110.457 -107)\"/>\n  <path style=\"fill:#423e4f;fill-opacity:1;stroke-width:.158378;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:0;paint-order:markers fill stroke\" d=\"M134.698 116.756a1.938 1.938 0 0 0-1.942 1.942v4.579c0 1.076.866 1.942 1.942 1.942h.099a1.938 1.938 0 0 0 1.942-1.942v-4.579a1.938 1.938 0 0 0-1.942-1.942zm47.592.067a1.938 1.938 0 0 0-1.942 1.942v4.579c0 1.076.866 1.942 1.942 1.942h.1a1.938 1.938 0 0 0 1.942-1.942v-4.579a1.938 1.938 0 0 0-1.943-1.942zm-30.013 4.28a2.025 2.025 0 0 0-1.459.525 2.025 2.025 0 0 0-.132 2.862s1.746 1.951 4.597 2.928c2.852.976 7.06.788 10.997-2.793a2.025 2.025 0 0 0 .134-2.862 2.025 2.025 0 0 0-2.86-.135c-3.026 2.755-5.186 2.565-6.96 1.958-1.775-.608-2.914-1.823-2.914-1.823a2.025 2.025 0 0 0-1.403-.66z\" transform=\"translate(-110.457 -107)\"/>\n</svg>\n<svg class=\"lilyfrog\" width=\"148.174\" height=\"76.104\" viewBox=\"0 0 39.204 20.136\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path style=\"fill:var(--lilypad);fill-opacity:1;stroke:none;stroke-width:4.76365;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M144.48 110.933A19.602 10.068 0 0 0 124.877 121a19.602 10.068 0 0 0 19.603 10.067 19.602 10.068 0 0 0 7.62-.792c.212-.206.287-.598-.062-1.34-.862-1.835-1.05-2.29-1.05-2.29s-.048-.533.485-.423c.534.11 5.52 1.49 5.52 1.49s1.215.382 2.2-.063a19.602 10.068 0 0 0 4.888-6.65 19.602 10.068 0 0 0-19.601-10.067z\" transform=\"translate(-124.877 -110.933)\"/>\n</svg>\n<svg class=\"lilymain\" width=\"249.943\" height=\"188.08\" viewBox=\"0 0 66.131 49.763\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path style=\"fill:var(--lilypad); filter:brightness(1.4) hue-rotate(-10deg) saturate(90%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"m1.146 30.765 13.972 6.428s1.147.59.098 1.017c-1.05.426-14.76 6.888-14.76 6.888s-.82.656-.262 1.18c.558.525 3.936 3.28 7.38 3.28s29.453-.033 29.453-.033 1.344.164 2.427-2.099c1.082-2.263 1.213-2.722 1.41-2.853.197-.131.558-.984 1.148.164.59 1.148 1.837 3.739 1.837 3.739s.262 1.082 2 1.05c1.739-.033 9.676-.033 9.676-.033s5.87-.328 8.92-5.609c3.051-5.28.952-10.364.952-10.364s-2.493-5.543-6.756-6.757c0 0-9.046-3.957-17.163-3.632-8.117.325-17.115 2.922-17.115 2.922l-17.58.093s-4.685.881-6.262 3.061c0 0-.835.902.625 1.558z\"/>\n  <ellipse style=\"fill:var(--lilypad);fill-opacity:1;stroke-width:4.70067;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" cx=\"41.467\" cy=\"30.982\" rx=\"15.912\" ry=\"7.807\"/>\n  <path style=\"fill:var(--lilypad);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M65.96 35.796a12.22 12.22 0 0 1-1.605 5.076c-3.05 5.28-8.921 5.608-8.921 5.608s-7.937 0-9.676.033c-1.738.033-2-1.05-2-1.05s-1.247-2.59-1.837-3.738c-.59-1.148-.951-.295-1.148-.164-.197.131-.328.59-1.41 2.853-1.082 2.263-2.427 2.1-2.427 2.1s-26.009.032-29.453.032c-2.179 0-4.329-1.102-5.758-2.045l-1.268.597s-.82.656-.263 1.18c.558.525 3.936 3.28 7.38 3.28s29.453-.033 29.453-.033 1.345.164 2.427-2.099c1.082-2.263 1.213-2.722 1.41-2.853.197-.131.557-.984 1.148.164.59 1.148 1.836 3.739 1.836 3.739s.263 1.082 2.001 1.05c1.739-.034 9.676-.033 9.676-.033s5.87-.328 8.92-5.609c1.788-3.094 1.805-6.112 1.515-8.088z\"/>\n  <path style=\"fill:var(--lily1);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.57 30.599s-4.916 3.757-14.656-1.67-10.298-12.384-10.298-12.384 5.335-2.737 13.22 1.206C37.72 21.693 41.57 30.599 41.57 30.599z\"/>\n  <path style=\"fill:var(--lily1); filter:brightness(0.95) saturate(110%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.177 30.637s4.916 3.757 14.657-1.67c9.74-5.427 10.297-12.385 10.297-12.385s-5.334-2.736-13.22 1.206c-7.885 3.943-11.734 12.849-11.734 12.849zM21.676 15.621c-3.179-.041-5.06.924-5.06.924s.557 6.957 10.298 12.384c6.001 3.344 10.168 3.2 12.486 2.598-2.293-.095-5.277-.786-8.962-2.754-9.835-5.253-10.515-12.2-10.515-12.2s1.122-.599 3.108-.875a16.04 16.04 0 0 0-1.355-.077z\"/>\n  <path style=\"fill:var(--lily1);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M61.072 15.659c-.435.006-.895.03-1.378.08-.762 2.475-2.29 5.512-5.262 8.782-6.17 6.788-11.225 6.644-12.825 6.379 1.386.75 6.143 2.57 14.227-1.933 9.74-5.427 10.297-12.385 10.297-12.385s-1.88-.964-5.059-.923z\"/>\n  <path style=\"fill:var(--lily2);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.478 30.83s-6.865-.649-12.71-9.925C22.926 11.628 25.94 3.928 25.94 3.928s7.42 1.206 11.039 7.932c3.618 6.725 4.499 18.97 4.499 18.97z\"/>\n  <path style=\"fill:var(--lily2); filter:brightness(0.95) saturate(110%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M25.94 3.928s-3.016 7.7 2.829 16.977c5.844 9.276 12.709 9.926 12.709 9.926s-.03-.402-.096-1.078c-2.532-1.183-5.974-3.566-9.21-8.357-5.53-8.185-3.836-15.3-3.445-16.634-1.626-.643-2.788-.834-2.788-.834Z\"/>\n  <path style=\"fill:var(--lily2); filter:brightness(0.95) saturate(110%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.344 30.83s6.865-.649 12.71-9.925c5.844-9.277 2.829-16.977 2.829-16.977s-7.422 1.206-11.04 7.932c-3.617 6.725-4.499 18.97-4.499 18.97z\"/>\n  <path style=\"fill:var(--lily2);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M56.79 3.975s-3.213.522-6.441 2.795c.493.888 3.946 7.659.069 17.104-.452 1.1-.933 2.1-1.43 3.012 1.622-1.42 3.337-3.34 4.973-5.935 5.844-9.277 2.829-16.976 2.829-16.976z\"/>\n  <path style=\"fill:var(--lily3);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.29 0s-8.134 4.592-7.478 16.006c.656 11.413 7.61 14.824 7.61 14.824s7.871-4.854 7.74-16.005C49.03 3.674 41.29 0 41.29 0Z\"/>\n  <path style=\"fill:var(--lily3); filter:brightness(0.95) saturate(110%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.29 0s-8.134 4.592-7.478 16.006c.656 11.413 7.61 14.825 7.61 14.825s.686-.426 1.648-1.307c-2.015-1.612-5.636-5.59-6.096-13.585-.48-8.373 3.878-12.99 6.082-14.773C42.031.352 41.29 0 41.29 0Z\"/>\n</svg>", "vip": "<svg class=\"lilyvip\" width=\"249.943\" height=\"188.08\" viewBox=\"0 0 66.131 49.763\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path style=\"fill:var(--lilypad); filter:brightness(1.4) hue-rotate(-10deg) saturate(90%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"m1.146 30.765 13.972 6.428s1.147.59.098 1.017c-1.05.426-14.76 6.888-14.76 6.888s-.82.656-.262 1.18c.558.525 3.936 3.28 7.38 3.28s29.453-.033 29.453-.033 1.344.164 2.427-2.099c1.082-2.263 1.213-2.722 1.41-2.853.197-.131.558-.984 1.148.164.59 1.148 1.837 3.739 1.837 3.739s.262 1.082 2 1.05c1.739-.033 9.676-.033 9.676-.033s5.87-.328 8.92-5.609c3.051-5.28.952-10.364.952-10.364s-2.493-5.543-6.756-6.757c0 0-9.046-3.957-17.163-3.632-8.117.325-17.115 2.922-17.115 2.922l-17.58.093s-4.685.881-6.262 3.061c0 0-.835.902.625 1.558z\"/>\n  <ellipse style=\"fill:var(--lilypad);fill-opacity:1;stroke-width:4.70067;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" cx=\"41.467\" cy=\"30.982\" rx=\"15.912\" ry=\"7.807\"/>\n  <path style=\"fill:var(--lilypad);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M65.96 35.796a12.22 12.22 0 0 1-1.605 5.076c-3.05 5.28-8.921 5.608-8.921 5.608s-7.937 0-9.676.033c-1.738.033-2-1.05-2-1.05s-1.247-2.59-1.837-3.738c-.59-1.148-.951-.295-1.148-.164-.197.131-.328.59-1.41 2.853-1.082 2.263-2.427 2.1-2.427 2.1s-26.009.032-29.453.032c-2.179 0-4.329-1.102-5.758-2.045l-1.268.597s-.82.656-.263 1.18c.558.525 3.936 3.28 7.38 3.28s29.453-.033 29.453-.033 1.345.164 2.427-2.099c1.082-2.263 1.213-2.722 1.41-2.853.197-.131.557-.984 1.148.164.59 1.148 1.836 3.739 1.836 3.739s.263 1.082 2.001 1.05c1.739-.034 9.676-.033 9.676-.033s5.87-.328 8.92-5.609c1.788-3.094 1.805-6.112 1.515-8.088z\"/>\n  <path style=\"fill:var(--lily1);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.57 30.599s-4.916 3.757-14.656-1.67-10.298-12.384-10.298-12.384 5.335-2.737 13.22 1.206C37.72 21.693 41.57 30.599 41.57 30.599z\"/>\n  <path style=\"fill:var(--lily1); filter:brightness(0.95) saturate(110%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.177 30.637s4.916 3.757 14.657-1.67c9.74-5.427 10.297-12.385 10.297-12.385s-5.334-2.736-13.22 1.206c-7.885 3.943-11.734 12.849-11.734 12.849zM21.676 15.621c-3.179-.041-5.06.924-5.06.924s.557 6.957 10.298 12.384c6.001 3.344 10.168 3.2 12.486 2.598-2.293-.095-5.277-.786-8.962-2.754-9.835-5.253-10.515-12.2-10.515-12.2s1.122-.599 3.108-.875a16.04 16.04 0 0 0-1.355-.077z\"/>\n  <path style=\"fill:var(--lily1);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M61.072 15.659c-.435.006-.895.03-1.378.08-.762 2.475-2.29 5.512-5.262 8.782-6.17 6.788-11.225 6.644-12.825 6.379 1.386.75 6.143 2.57 14.227-1.933 9.74-5.427 10.297-12.385 10.297-12.385s-1.88-.964-5.059-.923z\"/>\n  <path style=\"fill:var(--lily2);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.478 30.83s-6.865-.649-12.71-9.925C22.926 11.628 25.94 3.928 25.94 3.928s7.42 1.206 11.039 7.932c3.618 6.725 4.499 18.97 4.499 18.97z\"/>\n  <path style=\"fill:var(--lily2); filter:brightness(0.95) saturate(110%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M25.94 3.928s-3.016 7.7 2.829 16.977c5.844 9.276 12.709 9.926 12.709 9.926s-.03-.402-.096-1.078c-2.532-1.183-5.974-3.566-9.21-8.357-5.53-8.185-3.836-15.3-3.445-16.634-1.626-.643-2.788-.834-2.788-.834Z\"/>\n  <path style=\"fill:var(--lily2); filter:brightness(0.95) saturate(110%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.344 30.83s6.865-.649 12.71-9.925c5.844-9.277 2.829-16.977 2.829-16.977s-7.422 1.206-11.04 7.932c-3.617 6.725-4.499 18.97-4.499 18.97z\"/>\n  <path style=\"fill:var(--lily2);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M56.79 3.975s-3.213.522-6.441 2.795c.493.888 3.946 7.659.069 17.104-.452 1.1-.933 2.1-1.43 3.012 1.622-1.42 3.337-3.34 4.973-5.935 5.844-9.277 2.829-16.976 2.829-16.976z\"/>\n  <path style=\"fill:var(--lily3);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.29 0s-8.134 4.592-7.478 16.006c.656 11.413 7.61 14.824 7.61 14.824s7.871-4.854 7.74-16.005C49.03 3.674 41.29 0 41.29 0Z\"/>\n  <path style=\"fill:var(--lily3); filter:brightness(0.95) saturate(110%);fill-opacity:1;stroke-width:4.65;stroke-linecap:round;stroke-linejoin:round;stroke-opacity:.964706;paint-order:markers fill stroke\" d=\"M41.29 0s-8.134 4.592-7.478 16.006c.656 11.413 7.61 14.825 7.61 14.825s.686-.426 1.648-1.307c-2.015-1.612-5.636-5.59-6.096-13.585-.48-8.373 3.878-12.99 6.082-14.773C42.031.352 41.29 0 41.29 0Z\"/>\n</svg>"};
  const BADGES = {"subscriber": "<svg class=\"svgbadge\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\" version=\"1.1\" id=\"svg902\" viewBox=\"0 0 96 96\">\n  <defs id=\"defs906\"/>\n  <g id=\"g908\">\n    <path fill=\"{badgescolor}\" d=\"M 19.403191,10.959868 0.36376509,36.881015 47.159463,87.576356 95.560901,35.504671 76.292081,11.189259 Z\" id=\"path916\"/>\n  </g>\n</svg>", "streamer": "<svg class=\"svgbadge\" width=\"258.166\" height=\"258.166\" viewBox=\"0 0 68.306 68.306\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path style=\"fill:{badgescolor};stroke-width:3.293;stroke-linecap:round;stroke-linejoin:round;-inkscape-stroke:none;paint-order:stroke fill markers\" d=\"M100.243 106.668c-.419 0-.838.158-1.158.476L82.462 123.6l-12.86-11.883c-1.078-.997-2.823-.192-2.764 1.275l1.243 31.403a1.646 1.646 0 0 0 1.646 1.581h60.323c.877 0 1.6-.687 1.644-1.564l1.596-32.113c.074-1.505-1.743-2.31-2.809-1.246l-12.502 12.502-16.578-16.412a1.642 1.642 0 0 0-1.158-.476z\" transform=\"translate(-65.823 -93.145)\"/>\n</svg>", "manager": "<svg class=\"svgbadge\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\" version=\"1.1\" id=\"svg966\" viewBox=\"0 0 96 96\">\n  <defs id=\"defs970\"/>\n  <g id=\"g972\">\n    <path fill=\"{badgescolor}\" stroke=\"{badgescolor}\" d=\"m 5.514926,89.698649 6.163741,6.001538 19.302241,-12.65189 13.1385,12.489686 8.110185,-7.785778 L 39.253297,76.073538 90.671872,29.196667 90.509668,0.97322224 56.771297,1.7842408 23.843945,62.448427 10.705445,51.742982 4.8661112,59.690964 16.706982,70.396408 Z\" id=\"path976\"/>\n  </g>\n</svg>", "vip": "\n<svg class=\"svgbadge\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:svg=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 30.074135 21.467426\" version=\"1.1\" id=\"svg5\" xml:space=\"preserve\"><defs id=\"defs2\"/><g id=\"layer1\" transform=\"translate(-72.032296,-84.451693)\"><path id=\"rect237\" style=\"fill:{badgescolor};stroke-width:0\" d=\"m 76.467684,84.451693 c -2.457256,0 -4.435388,1.978132 -4.435388,4.435388 v 12.596649 c 0,2.45725 1.978132,4.43539 4.435388,4.43539 h 12.774414 c 2.457256,0 4.435388,-1.97814 4.435388,-4.43539 v -1.44074 l 8.403624,3.88762 0.0253,-8.658906 -0.3328,-8.654252 -8.096144,4.028178 v -1.758549 c 0,-2.457256 -1.978132,-4.435388 -4.435388,-4.435388 z\"/></g></svg>\n"};
  const ALERT_PREFIX = "<div class=\"message-row animation1\">\n<div class=\"alertcont\">\n\n\n<div class=\"alerttextwrap\">\n<svg class=\"alertlily\" width=\"685.29\" height=\"687.997\" viewBox=\"0 0 181.316 182.032\" xml:space=\"preserve\" xmlns=\"http://www.w3.org/2000/svg\">\n  <path style=\"opacity:1;fill:var(--frog1);fill-opacity:1;stroke:none;stroke-width:4.23409;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke\" d=\"M358.134 53.022a37.435 37.435 0 0 0-37.436 37.436 37.435 37.435 0 0 0 37.436 37.435 37.435 37.435 0 0 0 35.954-27.08l-12.644-8.667 13.987-4.877a37.435 37.435 0 0 0-37.297-34.247Zm127.21 21.29a16.323 16.323 0 0 0-16.323 16.323 16.323 16.323 0 0 0 16.322 16.323 16.323 16.323 0 0 0 16.323-16.323 16.323 16.323 0 0 0-16.322-16.322Zm-44.862 42.198a58.964 58.964 0 0 0-56.592 58.875 58.964 58.964 0 0 0 58.964 58.963 58.964 58.964 0 0 0 58.963-58.963 58.964 58.964 0 0 0-38.936-55.453L449 133.107z\" transform=\"translate(-320.501 -53.022)\"/>\n  <path style=\"opacity:1;fill:var(--lily1);fill-opacity:1;stroke:none;stroke-width:3.82482;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:none;stroke-opacity:1;paint-order:markers fill stroke\" d=\"M363.456 137.829a17.565 35.484 0 0 0-15.94 20.623 35.484 17.565 30 0 0-25.79 3.506 35.484 17.565 30 0 0 9.894 24.118 17.565 35.484 60 0 0-9.539 23.785 17.565 35.484 60 0 0 25.231 3.673 17.565 35.484 0 0 0 16.144 21.52 17.565 35.484 0 0 0 16.144-21.52 35.484 17.565 30 0 0 25.231-3.673 35.484 17.565 30 0 0-9.523-23.785 17.565 35.484 60 0 0 9.878-24.118 17.565 35.484 60 0 0-25.78-3.508 17.565 35.484 0 0 0-15.95-20.621z\" transform=\"translate(-320.501 -53.022)\"/>\n</svg>\n<span class=\"alertName\">";

  const $container = () => document.querySelector('.main-container');
  const log = (...a) => { if (debug) console.log('[CHZZK native exact]', ...a); };
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const field = (k, f='') => FIELD[k] ?? f;

  function hexToHsl(hex, satAdd=0, lightAdd=0) {
    hex = String(hex || '#bce78e').trim();
    if (!hex.startsWith('#')) return hex;
    if (hex.length === 4) hex = '#' + hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
    const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b); let h=0,s=0,l=(max+min)/2; const d=max-min;
    if(d){ s=d/(1-Math.abs(2*l-1)); if(max===r)h=((g-b)/d)%6; else if(max===g)h=(b-r)/d+2; else h=(r-g)/d+4; h=Math.round(h*60); if(h<0)h+=360; }
    return `hsl(${h},${Math.max(0,Math.min(100,Math.round(s*100+satAdd)))}%,${Math.max(0,Math.min(100,Math.round(l*100+lightAdd)))}%)`;
  }

  function applyVars(){
    const lily = field('lily1', '#f592b4');
    const frog = field('frog1', '#bce78e');
    const vars = {
      '--namesSize': `${field('namesSize',16)}px`,
      '--msgSize': `${field('msgSize',16)}px`,
      '--msgback': field('msgback','#ffffff'),
      '--namesBold': field('namesBold','700'),
      '--msgBold': field('msgBold','700'),
      '--textback': field('textback','rgba(173,143,255,0)'),
      '--namesFont': `'${field('namesFont','Quicksand')}', sans-serif`,
      '--msgFont': `'${field('msgFont','Quicksand')}', sans-serif`,
      '--namescolor': field('namescolor','#ffffff'),
      '--badgescolor': field('badgescolor','#ffffff'),
      '--outlinecol': field('accentcolor','#dcbb96'),
      '--accentcolor': field('accentcolor','#dcbb96'),
      '--msgcolor': field('msgcolor','#47843b'),
      '--alerttext': field('alerttext','#47843b'),
      '--msgHide': `${field('msgHide',7)}s`,
      '--alertback': field('alertsboxcol','#ffffff'),
      '--frog1': frog,
      '--frog2': field('frog2', hexToHsl(frog,0,8)),
      '--lily1': lily,
      '--lily2': field('lily2', hexToHsl(lily,21,12)),
      '--lily3': field('lily3', hexToHsl(lily,30,20)),
      '--lilypad': field('lilypad','#82c080')
    };
    for (const [k,v] of Object.entries(vars)) {
      document.documentElement.style.setProperty(k,v);
      document.body?.style.setProperty(k,v);
      $container()?.style.setProperty(k,v);
    }
    injectNativeFixCss();
  }

  function replaceFields(html) {
    return String(html || '')
      .replaceAll('{badgescolor}', field('badgescolor', '#ffffff'))
      .replaceAll('{bordercol}', field('bordercol', '#97d561'))
      .replaceAll('{msgback}', field('msgback', '#ffffff'))
      .replaceAll('{nameback}', field('nameback', '#97d561'))
      .replaceAll('{alertsboxcol}', field('alertsboxcol', '#ffffff'))
      .replaceAll('{alerttext}', field('alerttext', '#47843b'))
      .replaceAll('{alertnames}', field('alertnames', '#47843b'))
      .replaceAll('{namescolor}', field('namescolor', '#ffffff'))
      .replaceAll('{msgcolor}', field('msgcolor', '#47843b'))
      .replaceAll('{frog1}', field('frog1', '#bce78e'))
      .replaceAll('{lily1}', field('lily1', '#f592b4'))
      .replaceAll('{lilypad}', field('lilypad', '#82c080'));
  }

  function roleKey(role) {
    const r = String(role || '').toLowerCase();
    if (r.includes('streamer') || r.includes('broadcaster') || r.includes('owner')) return 'streamer';
    if (r.includes('manager') || r.includes('moderator') || r === 'mod') return 'manager';
    if (r.includes('subscriber') || r === 'sub') return 'subscriber';
    if (r.includes('follower') || r === 'vip') return 'vip';
    return 'default';
  }

  function escapeRegExp(v) {
    return String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeEmoteList(payload, text, emotes) {
    const list = Array.isArray(emotes) ? [...emotes] : [];
    const emojiMap = payload?.raw?.data?.emojis || payload?.emojis || payload?.raw?.emojis || {};
    if (emojiMap && typeof emojiMap === 'object' && !Array.isArray(emojiMap)) {
      Object.entries(emojiMap).forEach(([code, value]) => {
        if (!code) return;
        const url = typeof value === 'string'
          ? value
          : (value?.url || value?.imageUrl || value?.image || value?.staticUrl || value?.gifUrl);
        if (url) list.push({ code, name: code, url });
      });
    }
    if (String(text).includes('{:d_51:}') && !list.some(e => (e.code || e.name) === '{:d_51:}')) {
      list.push({ code:'{:d_51:}', name:'{:d_51:}', url:'https://ssl.pstatic.net/static/nng/glive/icon/d_51.png' });
    }
    return list;
  }

  function renderEmotes(text, emotes, payload) {
    let source = String(text ?? '');
    const list = normalizeEmoteList(payload, source, emotes);
    const tokens = [];
    list.forEach((e, idx) => {
      const code = e.code || e.name || e.id;
      const url = e.url || e.imageUrl || e.image;
      if (!code || !url) return;
      const token = `__CHZZK_EMOTE_${idx}__`;
      tokens.push({ token, url });
      source = source.replace(new RegExp(escapeRegExp(code), 'g'), token);
    });

    source = source.replace(/\{:\s*([^:}]+)\s*:\}/g, (_, inner) => {
      const value = String(inner || '').trim();
      if (!value) return '';
      return /[^\u0000-\u007f]/.test(value) ? value : '';
    });

    let html = esc(source);
    for (const e of tokens) {
      html = html.replace(new RegExp(e.token, 'g'), `<img class="emote default" alt="" src="${esc(e.url)}" onerror="this.hidden=true">`);
    }
    return html;
  }

  function badgeHtml(role) {
    const key = roleKey(role);
    const svg = BADGES[key] || '';
    if (!svg) return '';
    return `
      <div class="badgescont">
        <div class="badgesbox">
          <span class="badges">
            <span class="custombadge">${replaceFields(svg)}</span>
          </span>
        </div>
      </div>`;
  }

  function trimOldMessages() {
    const c = $container();
    if (!c) return;
    const limitOn = Boolean(field('msgLimit', false));
    const limit = Number(field('msgLimitAmount', 4));
    if (limitOn && limit > 0) {
      while (c.children.length > limit) c.removeChild(c.firstElementChild);
    }
  }

  function renderChat(payload) {
    if (!payload || (payload.clientId && String(payload.clientId) !== clientId)) return;
    applyVars();
    const c = $container();
    if (!c) return console.error('[CHZZK native exact] .main-container not found');

    const key = roleKey(payload.role);
    const msgId = esc(String(payload.id || payload.msgId || `chzzk-${Date.now()}-${seq++}`));
    const nick = esc(payload.nickname || payload.displayName || payload.name || '익명');
    const textHtml = renderEmotes(payload.message || payload.content || payload.text || '', payload.emotes, payload);
    const decoration = replaceFields(DECOR[key] || DECOR.default || '');
    const rowClass = key === 'streamer' ? 'streamer broadcaster' : key === 'manager' ? 'mod moderator' : key === 'subscriber' ? 'subscriber sub' : key === 'vip' ? 'vip' : 'default';

    const row = document.createElement('div');
    row.className = `message-row animation1 ${rowClass}`;
    row.dataset.sender = nick;
    row.dataset.msgid = msgId;
    row.id = `msg-${msgId}`;
    row.innerHTML = `
      <span class="namebox">
        ${badgeHtml(key)}
        <span class="name">${nick}</span>
      </span>
      <div class="msgcont">
        <div class="messagebox">
          ${decoration}
          <span class="message">${textHtml}</span>
        </div>
      </div>
    `;

    if (field('alignMessages', 'bottom') === 'top') c.appendChild(row);
    else c.appendChild(row);

    if (field('msgHideOpt', false)) row.classList.add('animationOut');
    trimOldMessages();
    log('rendered chat', { key, msgId, payload });
  }

  function renderDonation(payload) {
    if (!payload || (payload.clientId && String(payload.clientId) !== clientId)) return;
    applyVars();
    const c = $container();
    if (!c) return;

    const nick = esc(payload.nickname || payload.donatorNickname || payload.displayName || payload.name || '익명');
    const amount = Number(payload.amount || payload.payAmount || payload.value || 0);
    const currency = esc(String(payload.currency || 'CHEEZE').toLowerCase() === '치즈' ? 'CHEEZE' : String(payload.currency || 'CHEEZE').toUpperCase());

    const row = document.createElement('div');
    row.innerHTML = replaceFields(ALERT_PREFIX) +
      `${nick}</span><span class="alerttext"> tipped ${currency} ${amount}</span></div></div></div>`;

    const node = row.firstElementChild;
    if (field('alignMessages', 'bottom') === 'top') c.appendChild(node);
    else c.appendChild(node);
    if (field('msgHideOpt', false)) node.classList.add('animationOut');
    trimOldMessages();
    log('rendered donation', payload);
  }

  window.__CHZZK_SE_TEST_CHAT = (p={}) => renderChat({
    type:'chat', clientId, id:'direct-test-'+Date.now(), createdAt:Date.now(),
    nickname:p.nickname||'스트리머테스트',
    userId:p.userId||'direct-test-user',
    role:p.role||'streamer',
    message:p.message||'방송 전 디자인 확인용 테스트 채팅입니다 {:d_51:}',
    emotes:p.emotes||[{code:'{:d_51:}',name:'{:d_51:}',url:'https://ssl.pstatic.net/static/nng/glive/icon/d_51.png'}]
  });

  window.__CHZZK_SE_TEST_DONATION = (p={}) => renderDonation({
    type:'donation', clientId, id:'direct-donation-test-'+Date.now(), createdAt:Date.now(),
    nickname:p.nickname||'치즈테스트',
    amount:Number(p.amount||1000),
    currency:p.currency||'CHEEZE',
    message:p.message||'방송 전 치즈 알림 테스트입니다'
  });

  function injectNativeFixCss() {
    if (document.getElementById('chzzk-native-fix-css')) return;
    const style = document.createElement('style');
    style.id = 'chzzk-native-fix-css';
    style.textContent = `
      .namebox { overflow: visible !important; }
      .badgescont { top: 50% !important; right: -10px !important; transform: translate(100%, -50%) !important; z-index: 40 !important; pointer-events: none !important; }
      .badgesbox { display: flex !important; align-items: center !important; justify-content: center !important; min-width: calc(var(--namesSize) + 8px) !important; height: var(--namesSize) !important; padding: 3px 7px !important; line-height: 1 !important; overflow: visible !important; }
      .badges { top: auto !important; transform: none !important; height: calc(var(--namesSize) - 2px) !important; display: inline-flex !important; align-items: center !important; }
      .custombadge { top: auto !important; transform: none !important; width: calc(var(--namesSize) - 2px) !important; height: calc(var(--namesSize) - 2px) !important; margin-left: 0 !important; }
      .custombadge svg, .custombadge img { position: relative !important; top: auto !important; left: auto !important; width: calc(var(--namesSize) - 2px) !important; height: calc(var(--namesSize) - 2px) !important; display: block !important; }
      .message-row { padding-bottom: 36px !important; margin: 0 !important; }
      .message-row + .message-row { margin-top: 0 !important; }
      .msgcont { top: -10px !important; }
      .messagebox { padding-top: 16px !important; padding-bottom: 15px !important; min-height: 48px !important; }
      .message { overflow: visible !important; }
      .message .emote { display:inline-block; width:1.45em; height:1.45em; object-fit:contain; vertical-align:-0.25em; background-size:contain; }
      .message .emote[hidden] { display:none !important; }
    `;
    document.head.appendChild(style);
  }


  const renderedKeys = new Map();
  function payloadKey(type, payload) {
    const rawData = payload?.raw?.data || {};
    const time = rawData.messageTime || payload?.createdAt || '';
    const sender = rawData.senderChannelId || payload?.userId || payload?.nickname || '';
    const text = rawData.content || payload?.message || payload?.id || '';
    return `${type}|${sender}|${time}|${text}`;
  }
  function once(type, handler) {
    return (payload) => {
      const key = payloadKey(type, payload);
      const now = Date.now();
      for (const [k, t] of renderedKeys.entries()) if (now - t > 15000) renderedKeys.delete(k);
      if (renderedKeys.has(key)) { log('duplicate skipped', key); return; }
      renderedKeys.set(key, now);
      handler(payload);
    };
  }

  function connectSocket(){
    socket = io('/', {
      transports:['websocket','polling'],
      query:{clientId},
      auth:{clientId},
      reconnection:true,
      reconnectionAttempts:Infinity,
      reconnectionDelay:1000
    });
    socket.on('connect', () => log('socket connected', socket.id));
    socket.on('connect_error', e => console.error('[CHZZK native exact] socket error', e?.message || e));
    const onChat = once('chat', renderChat);
    const onDonation = once('donation', renderDonation);
    socket.on('chzzk:chat', onChat);
    socket.on(`chzzk:chat:${clientId}`, onChat);
    socket.on('chzzk:donation', onDonation);
    socket.on(`chzzk:donation:${clientId}`, onDonation);
    socket.on('chzzk:status', s => log('status', s));
  }

  function start() {
    applyVars();
    connectSocket();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
