export function flattenCategoryOptions(nodes, depth = 0, excludeId = null) {
  const options = [];
  nodes.forEach((node) => {
    if (node.id === excludeId) {
      return;
    }
    options.push({ id: node.id, name: node.name, depth });
    if (node.children?.length) {
      options.push(...flattenCategoryOptions(node.children, depth + 1, excludeId));
    }
  });
  return options;
}
