variable "url" {
  type    = string
  default = getenv("DATABASE_URL")
}

env "turso" {
  url     = var.url
  exclude = ["_litestream*"]
}
