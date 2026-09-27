export const demoRooms = Object.freeze([
  { id: 1, name: "Joy House · Ban công nội thất", area: "Phú Nhuận, TP.HCM", address: "18 Hoa Sứ, Phú Nhuận", price: 5200000, size: "28m²", type: "Ban công", score: 4.8, verified: true, landlord: "Cô Mai", amenities: ["Máy lạnh", "Wifi", "Ban công", "Giặt riêng"] },
  { id: 2, name: "Lina Studio · Cửa sổ lớn", area: "Quận 3, TP.HCM", address: "42 Võ Văn Tần, Quận 3", price: 4600000, size: "24m²", type: "Studio", score: 4.8, verified: true, landlord: "Anh Long", amenities: ["Máy lạnh", "Bếp riêng", "Wifi", "Thang máy"] },
  { id: 3, name: "An House · Gần Landmark 81", area: "Bình Thạnh, TP.HCM", address: "91 Nguyễn Hữu Cảnh, Bình Thạnh", price: 5100000, size: "26m²", type: "Nội thất cơ bản", score: 4.9, verified: true, landlord: "Chú Thành", amenities: ["Máy lạnh", "Tủ đồ", "Wifi", "Giữ xe"] },
  { id: 4, name: "Campus Nest · Gác lửng", area: "TP. Thủ Đức, TP.HCM", address: "6 Đường 621, Đông Hòa", price: 3800000, size: "20m²", type: "Gác lửng", score: 4.6, verified: true, landlord: "Anh Phúc", amenities: ["Gác lửng", "Bếp", "Wifi", "Giữ xe"] }
]);

export const demoLandlord = Object.freeze({
  rooms: 8,
  occupied: 5,
  collected: 21900000,
  expected: 23400000,
  debt: 1500000,
  openTickets: 2
});
