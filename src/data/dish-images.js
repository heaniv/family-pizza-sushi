const IMAGE_POOLS = {
  pizza: ["pizza-1.webp", "pizza-2.webp", "pizza-3.webp"],
  sushi: ["sushi-1.webp", "sushi-2.webp", "sushi-3.webp"],
  hot: ["hot-1.webp", "hot-2.webp", "hot-3.webp"],
  salads: ["salad-1.webp", "salad-2.webp", "salad-3.webp"],
  sides: ["sides-1.webp", "sides-2.webp", "sides-3.webp"],
  desserts: ["dessert-1.webp", "dessert-2.webp", "dessert-3.webp"],
};

export function dishImage(item) {
  const [category, group = "0", index = "0"] = item.id.split("-");
  const pool = IMAGE_POOLS[category] || IMAGE_POOLS.pizza;
  const selection = (Number(group) * 7 + Number(index) * 3) % pool.length;
  return `/assets/menu/${pool[selection]}`;
}
