"use client";

import React, { memo } from "react";
import styles from "./Background.module.css";

function Background() {
  return <div className={styles.fixedBg} aria-hidden="true" />;
}

export default memo(Background);
