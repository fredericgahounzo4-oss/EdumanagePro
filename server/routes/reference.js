const express = require("express");
const { NIVEAUX, ALL_SERIES } = require("../lib/reference");

const router = express.Router();

router.get("/niveaux", (req, res) => res.json(NIVEAUX));
router.get("/series", (req, res) => res.json(ALL_SERIES));

module.exports = router;
