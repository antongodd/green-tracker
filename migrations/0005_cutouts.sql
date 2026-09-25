-- Remove background (D26, 0.19.0).
--
-- A cut-out is a version of a photo, like a crop: its image set holds a transparent
-- PNG cut-out (still stored under the key cropped.jpg, served as image/png from its
-- stored content type) and a PNG thumbnail. The crop columns keep the crop it was
-- made from, and the original is untouched, so Restore background is an ordinary
-- re-crop.
--
-- Columns with defaults only: the previous build keeps working while this is
-- applied (it never makes cut-outs, and everything it writes is "not a cut-out").

ALTER TABLE photos ADD COLUMN cutout INTEGER NOT NULL DEFAULT 0;
-- A pending set that is a cut-out; saving it makes the photo a cut-out.
ALTER TABLE uploads ADD COLUMN cutout INTEGER NOT NULL DEFAULT 0;
