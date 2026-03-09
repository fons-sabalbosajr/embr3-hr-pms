import React, { useEffect, useMemo, useState } from "react";
import { Avatar } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { getServerBaseUrl, resolveServerAssetUrl } from "../../utils/assetUrl";

const UserAvatar = ({ src, name, size = 32, shape = "circle", className, style, icon, alt, user, ...rest }) => {
  // Support passing a `user` object for convenience — extract src/name from it
  const resolvedSrc = src || user?.avatarUrl || user?.avatar || user?.profilePicture || undefined;
  const resolvedName = name || user?.name || user?.username || undefined;

  const [errored, setErrored] = useState(false);

  const serverBase = getServerBaseUrl();

  useEffect(() => {
    setErrored(false);
  }, [resolvedSrc, serverBase]);

  const initials = useMemo(() => {
    if (!resolvedName) return null;
    const parts = String(resolvedName).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return null;
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    const letters = (first + last).toUpperCase();
    return letters || null;
  }, [resolvedName]);

  const effectiveSrc = useMemo(() => {
    if (errored) return undefined;
    const resolved = resolveServerAssetUrl(resolvedSrc);
    return resolved || undefined;
  }, [resolvedSrc, errored, serverBase]);

  return (
    <Avatar
      src={effectiveSrc}
      size={size}
      shape={shape}
      className={className}
      style={style}
      alt={alt || resolvedName || "avatar"}
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
