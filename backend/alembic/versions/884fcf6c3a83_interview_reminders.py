"""interview reminders

Revision ID: 884fcf6c3a83
Revises: f05d57a37719
Create Date: 2026-11-12 12:37:19.566908
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '884fcf6c3a83'
down_revision: Union[str, None] = 'f05d57a37719'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('interviews', sa.Column('reminded_day_before_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('interviews', sa.Column('reminded_hour_before_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('interviews', 'reminded_hour_before_at')
    op.drop_column('interviews', 'reminded_day_before_at')
