type ProductFormValues = {
  title: string;
  price: number;
  stockQuantity: number;
  categoryId: string;
  thumbnail?: File;
  bannerImage?: File;
  photos?: File[];
  features?: string[];
  giftCard?: unknown;
  gameTopUp?: unknown;
  subscription?: unknown;
};

export async function createProduct(values: ProductFormValues) {
  const formData = new FormData();

  formData.append("title", values.title);
  formData.append("price", String(values.price));
  formData.append("stockQuantity", String(values.stockQuantity));
  formData.append("categoryId", values.categoryId);

  if (values.features) {
    formData.append("features", JSON.stringify(values.features));
  }

  if (values.giftCard) {
    formData.append("giftCard", JSON.stringify(values.giftCard));
  }

  if (values.gameTopUp) {
    formData.append("gameTopUp", JSON.stringify(values.gameTopUp));
  }

  if (values.subscription) {
    formData.append("subscription", JSON.stringify(values.subscription));
  }

  if (values.thumbnail) {
    formData.append("thumbnail", values.thumbnail);
  }

  if (values.bannerImage) {
    formData.append("bannerImage", values.bannerImage);
  }

  values.photos?.forEach((file) => {
    formData.append("photos", file);
  });

  const response = await fetch("/api/products", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to create product");
  }

  return response.json();
}
