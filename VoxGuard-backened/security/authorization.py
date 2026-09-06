from fastapi import Depends, HTTPException, status

from database import User
from security.authentication import get_current_user


def require_roles(*roles: str):
	def dependency(user: User = Depends(get_current_user)) -> User:
		if user.role not in roles:
			raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
		return user
	return dependency
