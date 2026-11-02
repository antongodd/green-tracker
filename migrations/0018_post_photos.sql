-- Several photos in a post (D78, 0.67.0): up to 10, in order, swiped sideways. Each is the post's own copy
-- (cropped + thumb under u/<user>/s/<image_set>/). posts.image_set and posts.cutout stay, always the first photo,
-- so the previous build keeps working while this is applied. Every existing post's photo is copied in as its first.

CREATE TABLE post_photos (
  post_id   TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  image_set TEXT NOT NULL,
  cutout    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, position)
);
CREATE INDEX post_photos_user ON post_photos(user_id);

INSERT INTO post_photos (post_id, user_id, position, image_set, cutout) SELECT id, user_id, 0, image_set, cutout FROM posts;
