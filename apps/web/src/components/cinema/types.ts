export type CinemaLocation = {
  id: string;
  name: string;
  address: string;
  city: string;
  hotline: string;
};

export type AgeRating = "P" | "K" | "T13" | "T16" | "T18" | "C";

export type MovieFormat = "2D Phụ đề" | "2D Lồng tiếng" | "3D Dolby 7.1" | "IMAX Laser";

export type Movie = {
  id: string;
  title: string;
  originalTitle?: string;
  director: string;
  cast: string;
  durationMinutes: number;
  releaseDate: string;
  genres: string[];
  ageRating: AgeRating;
  ageWarning: string;
  poster: string;
  backdrop?: string;
  synopsis: string;
  formats: MovieFormat[];
  trailerUrl?: string;
  ratingScore: number;
  voteCount: number;
};

export type Showtime = {
  id: string;
  movieId: string;
  cinemaId: string;
  room: string;
  format: MovieFormat;
  startsAt: string; // ISO string or "19:45"
  dateStr: string; // "2026-11-02"
  priceRegular: number;
  priceVip: number;
  priceCouple: number;
  totalSeats: number;
  availableSeats: number;
};

export type SeatType = "regular" | "vip" | "couple";

export type Seat = {
  id: string;
  serverId?: string;
  row: string;
  number: number;
  type: SeatType;
  price: number;
  pairId?: string; // For couple seats
  isBestView?: boolean;
  status: "available" | "booked" | "selected";
};

export type FnBItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: "combo" | "snack" | "drink" | "entertainment";
  iconName: string;
  isPopular?: boolean;
  badge?: string;
};

export type TicketStatus =
  | "ELIGIBLE_REFUND"
  | "LOCKED_REFUND"
  | "CHECKED_IN"
  | "REFUNDED";

export type PopcornStatus = "NOT_PICKED" | "PREPARING" | "PICKED_UP";

export type Ticket = {
  id: string;
  bookingId?: string;
  bookingCode: string; // e.g. "STL-894210"
  phone: string;
  customerName: string;
  movie: Movie;
  showtime: Showtime;
  cinema: CinemaLocation;
  seats: string[]; // ["G07", "G08"]
  seatTypes: Record<string, SeatType>;
  u22Count: number;
  fnbItems: { item: FnBItem; quantity: number }[];
  totalPrice: number;
  status: TicketStatus;
  createdAt: string;
  popcornStatus: PopcornStatus;
  popcornCounter?: string;
  readyInMinutes?: number;
  qrToken?: string;
  qrImage?: string;
  seatQrCodes?: {
    ticketId: string;
    seatLabel: string;
    qrToken?: string;
    qrImage?: string;
    status: TicketStatus;
  }[];
  ageVerified?: boolean;
  checkedInAt?: string;
  refundMethod?: "WALLET" | "ORIGINAL_PAYMENT";
  refundedAmount?: number;
};

