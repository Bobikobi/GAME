/**
 * An EXPERIMENTAL deeper palette: the 32-colour core palette's families, each as a 7-step ramp with a
 * hue shift (darks cooler, lights warmer), plus a few families the core lacks (moss, redwood, teal, plum, violet).
 * Not a kit palette: it exists to measure how much of an outside reference's richness survives the import
 * when the palette is the only thing that changes. The first colour stays the kit's outline navy.
 */
export const RICH_PALETTE: readonly string[] = [
  // grey
  '#1b1a2e', '#2c2a44', '#3f3d5a', '#5d6177', '#7d8195', '#9fa3b3', '#c6cad6', '#f5f4ef',
  // green
  '#182d23', '#224d30', '#286c31', '#318c2a', '#5eab40', '#91cb5b', '#c7ea7b',
  // moss
  '#192616', '#2e4423', '#46612d', '#627f32', '#899d48', '#b2bb62', '#d8d580',
  // wood
  '#231411', '#44251c', '#643521', '#844421', '#a46436', '#c58951', '#e5b071',
  // redwood
  '#1e1012', '#361939', '#1f2054', '#216a6e', '#33893f', '#90a44a', '#bf7f64',
  // water
  '#0e101e', '#182441', '#1d3965', '#1b5488', '#317fab', '#4dafce', '#70e2f2',
  // teal
  '#152426', '#224346', '#2a6666', '#2e8580', '#45a59a', '#60c5b3', '#80e5cd',
  // red
  '#33151c', '#4b1c54', '#1c2375', '#169696', '#2cb737', '#c1d848', '#f98d6b',
  // orange
  '#592a20', '#74361e', '#904416', '#ac5708', '#c7801e', '#e3ad3b', '#ffdb5d',
  // yellow
  '#725431', '#8a662e', '#a17a27', '#b8911b', '#d0b332', '#e7d64d', '#fff96d',
  // skin
  '#59423a', '#745346', '#8e634e', '#a97354', '#c48f6c', '#dfad86', '#f9cda4',
  // plum
  '#1c121e', '#391f3b', '#582956', '#752e6a', '#92437c', '#af5c8e', '#cc78a0',
  // violet
  '#211b2d', '#34274a', '#472f66', '#5b3483', '#7a4a9f', '#9a63bc', '#bc80d8',
];
