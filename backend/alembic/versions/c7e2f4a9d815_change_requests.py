"""emergency change requests and interviewer moves

Revision ID: c7e2f4a9d815
Revises: a3c1d9e7b210
Create Date: 2026-11-12 22:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7e2f4a9d815'
down_revision: Union[str, None] = 'a3c1d9e7b210'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('interviews', sa.Column('moved_by_interviewer_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('interviews', sa.Column('move_reason', sa.String(length=300), nullable=True))
    op.create_table(
        'change_requests',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('interview_id', sa.Uuid(), nullable=False),
        sa.Column('journey_id', sa.Uuid(), nullable=False),
        sa.Column('student_id', sa.Uuid(), nullable=False),
        sa.Column('reason', sa.String(length=500), nullable=False),
        sa.Column('attempt_no', sa.Integer(), nullable=False),
        sa.Column('from_start_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('to_start_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('resolved_by', sa.Uuid(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_note', sa.String(length=300), nullable=True),
        sa.ForeignKeyConstraint(['interview_id'], ['interviews.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['journey_id'], ['interview_journeys.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_change_requests_interview_id', 'change_requests', ['interview_id'])
    op.create_index('ix_change_requests_journey_id', 'change_requests', ['journey_id'])
    op.create_index('ix_change_requests_student_id', 'change_requests', ['student_id'])
    op.create_index('ix_change_requests_status', 'change_requests', ['status'])


def downgrade() -> None:
    op.drop_table('change_requests')
    op.drop_column('interviews', 'move_reason')
    op.drop_column('interviews', 'moved_by_interviewer_at')
