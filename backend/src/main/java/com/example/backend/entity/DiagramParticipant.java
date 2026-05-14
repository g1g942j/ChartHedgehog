package com.example.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "diagram_participants", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"diagram_id", "user_id"})
})
public class DiagramParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "diagram_id", nullable = false)
    private Diagram diagram;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    private ParticipantRole role = ParticipantRole.VIEWER;

    @Column(name = "joined_at")
    private LocalDateTime joinedAt;

    public DiagramParticipant() {}

    public DiagramParticipant(Diagram diagram, User user, ParticipantRole role) {
        this.diagram = diagram;
        this.user = user;
        this.role = role;
    }


    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Diagram getDiagram() { return diagram; }
    public void setDiagram(Diagram diagram) { this.diagram = diagram; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public ParticipantRole getRole() { return role; }
    public void setRole(ParticipantRole role) { this.role = role; }
    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }

    @PrePersist
    protected void onCreate() {
        joinedAt = LocalDateTime.now();
    }
}