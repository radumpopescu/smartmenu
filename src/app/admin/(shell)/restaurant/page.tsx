import { redirect } from "next/navigation";

export default function RestaurantRedirect() {
  redirect("/admin/store");
}