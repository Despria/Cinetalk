export interface Movie {
  id: number;
  title: string;
  poster: string;
  genre: string;
  genres?: string[];
  reviewCount?: number;
  director: string;
  actors: string;
  releaseDate: string;
  runningTime: number;
  rating: number;
  slogan: string;
  plot: string;
}
