schema "main" {
}

table "shortened_links" {
  schema=schema.main
  primary_key  {
    columns = [column.shorthand]
  }
  column "url" {
    type = text
  }
  column "shorthand" {
    type = text
  }
  column "user_id" {
    type = text
  }
  column "last_modified"{
    type = datetime
    default = sql("current_timestamp")
  }
  index "idx_name" {
    columns = [
      column.user_id
    ]
  }
}