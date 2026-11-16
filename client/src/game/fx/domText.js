/**
 * Changes an element's text in place, by its text node's value: `textContent` swaps in a
 * new text node, which takes the old one out of layout and puts a new one in - on text
 * written many times a second (the ride's counters, popups), that's layout work every time.
 */
export function setText(el, text) {
  const node = el.firstChild
  if (node && node.nodeType === Node.TEXT_NODE && !node.nextSibling) node.nodeValue = text
  else el.textContent = text
}
