import React, { useEffect, useMemo, useState } from "react";
import { Avatar } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { getServerBaseUrl, resolveServerAssetUrl } from "../../utils/assetUrl";

const UserAvatar = ({ src, name, size = 32, shape = "circle", className, style, icon, alt, ...rest }) => {
  const [errored, setErrored] = useState(false);

  const serverBase = getServerBaseUrl();

  useEffect(() => {
    // If the previous attempt failed before server base was known,
    // allow retry once configuration becomes available.
    setErrored(false);
  }, [src, serverBase]);

  const initials = useMemo(() => {
    if (!name) return null;
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    const letters = (first + last).toUpperCase();
    return letters || null;
  }, [name]);

  const effectiveSrc = useMemo(() => {
    if (errored) return undefined;
    const resolved = resolveServerAssetUrl(src);
    return resolved || undefined;
  }, [src, errored, serverBase]);

  return (
    <Avatar
      src={effectiveSrc}
      size={size}
      shape={shape}
      className={className}
      style={style}
      alt={alt || name || "avatar"}
      onError={() => {
        setErrored(true);
        return false; // let Avatar fallback to children
      }}
      {...rest}
    >
      {icon || initials || <UserOutlined />}
    </Avatar>
  );
};

export default UserAvatar;
