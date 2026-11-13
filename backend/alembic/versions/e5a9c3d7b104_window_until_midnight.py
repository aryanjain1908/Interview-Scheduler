"""availability windows may end at midnight

Revision ID: e5a9c3d7b104
Revises: d4b8e1c2f6a3
Create Date: 2026-11-12 23:00:00
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'e5a9c3d7b104'
down_revision: Union[str, None] = 'd4b8e1c2f6a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('ck_window_time_order', 'availability_windows', type_='check')
    op.create_check_constraint(
        'ck_window_time_order', 'availability_windows', "start_time < end_time OR end_time = '00:00'"
    )


def downgrade() -> None:
    op.drop_constraint('ck_window_time_order', 'availability_windows', type_='check')
    op.create_check_constraint('ck_window_time_order', 'availability_windows', 'start_time < end_time')
