// Tipus per a les respostes de l'API

export type ApiError = {
  error: string
  code?: string
}

export type ApiSuccess<T> = {
  data: T
}

export type PaginatedResponse<T> = {
  data:  T[]
  total: number
  page:  number
  limit: number
}
